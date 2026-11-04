from flask import Blueprint, jsonify, request, current_app, send_file, Response
from sqlalchemy import or_, func
from models import db, Invoice, InvoiceItem, Order, Product, InventoryMovement
from routes.utils import get_current_user_obj, staff_required, upsert_client
from datetime import datetime
import io
import html
import random
import string

invoices_bp = Blueprint('invoices', __name__)


def generar_numero_factura():
    prefix = 'FAC-' + datetime.now().strftime('%Y%m') + '-'
    for _ in range(20):
        code = prefix + ''.join(random.choices(string.digits, k=4))
        if not Invoice.query.filter_by(numero_factura=code).first():
            return code
    return prefix + datetime.utcnow().strftime('%H%M%S')


def _deduct_pos_stock(product: Product, qty: int) -> None:
    fis = max(0, int(product.stock_fisico or 0))
    onl = max(0, int(product.stock_online or 0))
    if fis + onl == 0 and (product.stock or 0) > 0:
        fis = int(product.stock)
    if fis >= qty:
        product.stock_fisico = fis - qty
        product.stock_online = onl
    else:
        restante = qty - fis
        product.stock_fisico = 0
        product.stock_online = max(0, onl - restante)
    product.sync_stock()


@invoices_bp.route('/', methods=['GET'])
def get_invoices():
    estado = request.args.get('estado', '').strip()
    canal = request.args.get('canal', '').strip()
    q = request.args.get('q', '').strip()
    fecha_desde = request.args.get('fecha_desde', '').strip()
    fecha_hasta = request.args.get('fecha_hasta', '').strip()

    query = Invoice.query
    if estado:
        query = query.filter_by(estado=estado)
    if canal:
        query = query.filter_by(canal=canal)
    if q:
        like_q = f'%{q}%'
        query = query.filter(or_(
            Invoice.numero_factura.ilike(like_q),
            Invoice.nombre_cliente.ilike(like_q),
            Invoice.telefono_cliente.ilike(like_q)
        ))
    if fecha_desde:
        try:
            dt_desde = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Invoice.fecha >= dt_desde)
        except ValueError:
            pass
    if fecha_hasta:
        try:
            dt_hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            query = query.filter(Invoice.fecha <= dt_hasta)
        except ValueError:
            pass

    invoices = query.order_by(Invoice.fecha.desc()).all()
    return jsonify([i.to_dict() for i in invoices])


@invoices_bp.route('/<int:id>', methods=['GET'])
def get_invoice(id):
    invoice = db.session.get(Invoice, id)
    if not invoice:
        return jsonify({'error': 'Factura no encontrada.'}), 404
    return jsonify(invoice.to_dict())


@invoices_bp.route('/', methods=['POST'])
@staff_required
def create_invoice():
    data = request.get_json() or {}
    user = get_current_user_obj()
    iva_rate = float(current_app.config.get('IVA_RATE', 0.0))

    order_id = data.get('order_id')
    if order_id:
        order = db.session.get(Order, int(order_id))
        if not order:
            return jsonify({'error': 'El pedido indicado no existe.'}), 404
        if order.estado == 'cancelado':
            return jsonify({'error': 'No se puede facturar un pedido cancelado.'}), 400

        existing = Invoice.query.filter(
            Invoice.order_id == order.id,
            Invoice.estado != 'anulada'
        ).first()
        if existing:
            return jsonify({'error': f'El pedido {order.numero_pedido} ya tiene la factura activa {existing.numero_factura}.'}), 400

        numero_factura = generar_numero_factura()
        inv_items = [
            InvoiceItem(
                product_id=it.product_id,
                nombre_producto=it.nombre_producto,
                cantidad=it.cantidad,
                precio_unitario=it.precio_unitario,
                descuento=0,
                subtotal=it.subtotal
            )
            for it in order.items
        ]
        if (order.costo_envio or 0) > 0:
            inv_items.append(InvoiceItem(
                product_id=None,
                nombre_producto='Servicio de envío a domicilio',
                cantidad=1,
                precio_unitario=order.costo_envio,
                descuento=0,
                subtotal=order.costo_envio
            ))

        subtotal_fac = round((order.subtotal or 0) + (order.costo_envio or 0), 2)
        metodo_pago = data.get('metodo_pago') or order.metodo_pago or 'efectivo'
        monto_recibido = data.get('monto_recibido') if data.get('monto_recibido') is not None else order.monto_pago_cliente
        cambio = 0.0
        if monto_recibido not in (None, ''):
            monto_recibido = float(monto_recibido)
            cambio = max(0.0, round(monto_recibido - (order.total or 0), 2))
        else:
            monto_recibido = None

        invoice = Invoice(
            numero_factura=numero_factura,
            order_id=order.id,
            client_id=order.client_id,
            user_id=user.id if user else None,
            nombre_cliente=order.nombre_cliente or 'Consumidor Final',
            telefono_cliente=order.telefono_cliente,
            email_cliente=order.email_cliente,
            canal='colectivo' if order.canal == 'tienda_fisica' else 'online',
            tipo_descuento='monto',
            subtotal=subtotal_fac,
            descuento=round(order.descuento or 0, 2),
            iva=round(order.iva or 0, 2),
            total=round(order.total or 0, 2),
            metodo_pago=metodo_pago,
            monto_recibido=monto_recibido,
            cambio=cambio,
            estado=data.get('estado', 'pagada'),
            notas=data.get('notas') or f'Generada desde pedido {order.numero_pedido}',
            items=inv_items
        )
        if order.estado == 'pendiente':
            order.estado = 'confirmado'
        db.session.add(invoice)
        db.session.commit()
        return jsonify(invoice.to_dict()), 201

    # Venta directa POS / Concept Store (FRQ-0015 / UC3)
    items_data = data.get('items') or []
    nombre_cliente = (data.get('nombre_cliente') or 'Consumidor Final').strip() or 'Consumidor Final'
    telefono_cliente = (data.get('telefono_cliente') or '').strip() or None
    email_cliente = (data.get('email_cliente') or '').strip() or None
    canal = (data.get('canal') or 'colectivo').strip()
    metodo_pago = (data.get('metodo_pago') or 'efectivo').strip()
    tipo_descuento = (data.get('tipo_descuento') or 'monto').strip()

    inv_items = []
    agrupados = {}
    productos_map = {}

    if items_data:
        for raw in items_data:
            pid = raw.get('product_id') or raw.get('id')
            try:
                pid = int(pid)
                qty = int(raw.get('cantidad', 1))
            except (TypeError, ValueError):
                return jsonify({'error': 'Formato inválido en los productos de la factura.'}), 400
            if qty <= 0:
                return jsonify({'error': 'La cantidad debe ser mayor a cero.'}), 400
            agrupados[pid] = agrupados.get(pid, 0) + qty

        subtotal = 0.0
        for pid, qty in agrupados.items():
            product = db.session.get(Product, pid)
            if not product or not product.activo:
                return jsonify({'error': f'Producto #{pid} no disponible.'}), 400
            if (product.stock or 0) < qty:
                return jsonify({
                    'error': f'Stock insuficiente para "{product.nombre}" (disponible: {product.stock}, solicitado: {qty}).'
                }), 400
            productos_map[pid] = product
            precio = float(raw_price) if (raw_price := next((r.get('precio_unitario') for r in items_data if (r.get('product_id') or r.get('id')) == pid and r.get('precio_unitario') is not None), None)) is not None else product.precio_final
            item_sub = round(precio * qty, 2)
            subtotal += item_sub
            inv_items.append(InvoiceItem(
                product_id=product.id,
                nombre_producto=product.nombre,
                cantidad=qty,
                precio_unitario=round(precio, 2),
                descuento=0,
                subtotal=item_sub
            ))
    else:
        # Compatibilidad con facturación manual rápida por monto
        try:
            subtotal = float(data.get('subtotal') or 0)
        except (TypeError, ValueError):
            subtotal = 0.0
        if subtotal <= 0:
            return jsonify({'error': 'Seleccione al menos un producto o indique un subtotal mayor a cero.'}), 400
        concepto = (data.get('notas') or 'Venta directa en tienda').strip()
        inv_items.append(InvoiceItem(
            product_id=None,
            nombre_producto=concepto[:195],
            cantidad=1,
            precio_unitario=round(subtotal, 2),
            descuento=0,
            subtotal=round(subtotal, 2)
        ))

    raw_desc = max(0.0, float(data.get('descuento') or 0))
    if tipo_descuento == 'porcentaje':
        porcentaje = min(100.0, raw_desc)
        descuento_monto = round(subtotal * (porcentaje / 100.0), 2)
    else:
        tipo_descuento = 'monto'
        descuento_monto = min(subtotal, round(raw_desc, 2))

    base_imponible = max(0.0, subtotal - descuento_monto)
    iva = round(base_imponible * iva_rate, 2)
    total = round(base_imponible + iva, 2)

    monto_recibido = data.get('monto_recibido')
    cambio = 0.0
    if monto_recibido not in (None, ''):
        try:
            monto_recibido = float(monto_recibido)
            if metodo_pago == 'efectivo' and monto_recibido < total:
                return jsonify({'error': f'El monto recibido (C$ {monto_recibido:.2f}) es menor al total a pagar (C$ {total:.2f}).'}), 400
            cambio = max(0.0, round(monto_recibido - total, 2))
        except (TypeError, ValueError):
            monto_recibido = None
    else:
        monto_recibido = None

    client = upsert_client(nombre_cliente, telefono_cliente, email_cliente)
    numero_factura = generar_numero_factura()
    estado_fac = data.get('estado', 'pagada')
    if estado_fac not in ('emitida', 'pagada'):
        estado_fac = 'pagada'

    invoice = Invoice(
        numero_factura=numero_factura,
        order_id=None,
        client_id=client.id if client else None,
        user_id=user.id if user else None,
        nombre_cliente=nombre_cliente,
        telefono_cliente=telefono_cliente,
        email_cliente=email_cliente,
        canal=canal,
        tipo_descuento=tipo_descuento,
        subtotal=round(subtotal, 2),
        descuento=descuento_monto,
        iva=iva,
        total=total,
        metodo_pago=metodo_pago,
        monto_recibido=monto_recibido,
        cambio=cambio,
        estado=estado_fac,
        notas=data.get('notas'),
        items=inv_items
    )
    db.session.add(invoice)
    db.session.flush()

    # Descontar stock físico de los productos vendidos en POS
    for pid, qty in agrupados.items():
        product = productos_map[pid]
        stock_ant = product.stock or 0
        _deduct_pos_stock(product, qty)
        db.session.add(InventoryMovement(
            product_id=product.id,
            tipo='venta',
            ubicacion='fisico',
            cantidad=qty,
            stock_anterior=stock_ant,
            stock_nuevo=product.stock,
            motivo=f'Venta POS {numero_factura}',
            user_id=user.id if user else None
        ))

    db.session.commit()
    return jsonify(invoice.to_dict()), 201


@invoices_bp.route('/<int:id>/estado', methods=['PUT'])
@staff_required
def update_estado(id):
    invoice = db.session.get(Invoice, id)
    if not invoice:
        return jsonify({'error': 'Factura no encontrada.'}), 404

    data = request.get_json() or {}
    nuevo_estado = (data.get('estado') or invoice.estado).strip()
    if nuevo_estado not in ('emitida', 'pagada', 'anulada'):
        return jsonify({'error': 'Estado de factura no válido.'}), 400

    estado_anterior = invoice.estado
    user = get_current_user_obj()

    # Anulación de factura con devolución automática de stock (FRQ-0021 / UC4)
    if nuevo_estado == 'anulada' and estado_anterior != 'anulada':
        motivo = (data.get('motivo_anulacion') or data.get('motivo') or 'Anulación administrativa').strip()
        invoice.motivo_anulacion = motivo

        # Si es venta directa POS (sin pedido padre), devolver unidades al stock físico
        if invoice.order_id is None:
            for item in invoice.items:
                if item.product_id:
                    product = db.session.get(Product, item.product_id)
                    if product:
                        stock_ant = product.stock or 0
                        product.stock_fisico = max(0, int(product.stock_fisico or 0)) + item.cantidad
                        product.sync_stock()
                        db.session.add(InventoryMovement(
                            product_id=product.id,
                            tipo='anulacion',
                            ubicacion='fisico',
                            cantidad=item.cantidad,
                            stock_anterior=stock_ant,
                            stock_nuevo=product.stock,
                            motivo=f'Anulación {invoice.numero_factura}: {motivo}',
                            user_id=user.id if user else None
                        ))

    invoice.estado = nuevo_estado
    db.session.commit()
    return jsonify(invoice.to_dict())


@invoices_bp.route('/<int:id>/pdf', methods=['GET'])
def download_invoice_pdf(id):
    """Genera el comprobante de factura en PDF (ReportLab) o HTML imprimible de respaldo (FRQ-0019)."""
    invoice = db.session.get(Invoice, id)
    if not invoice:
        return jsonify({'error': 'Factura no encontrada.'}), 404

    inv = invoice.to_dict()
    fecha_str = inv['fecha'][:16].replace('T', ' ') if inv.get('fecha') else datetime.now().strftime('%Y-%m-%d %H:%M')

    try:
        from reportlab.lib.pagesizes import A5
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A5,
            leftMargin=24, rightMargin=24, topMargin=24, bottomMargin=24
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ShinyTitle', parent=styles['Heading1'],
            fontSize=15, textColor=colors.HexColor('#1A4973'), spaceAfter=2
        )
        sub_style = ParagraphStyle(
            'ShinySub', parent=styles['Normal'],
            fontSize=8.5, textColor=colors.HexColor('#4A607A'), leading=11
        )
        normal_sm = ParagraphStyle(
            'ShinyBody', parent=styles['Normal'],
            fontSize=9, textColor=colors.HexColor('#1E293B'), leading=12
        )

        elements = [
            Paragraph('SHINY SKIN — K-Beauty & Skincare', title_style),
            Paragraph('Concept Store · Camino de Oriente, Managua, Nicaragua · Tel: +505 8888-0000', sub_style),
            Spacer(1, 8),
            Paragraph(f"<b>Comprobante:</b> {inv['numero_factura']} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Estado:</b> {inv['estado'].upper()}", normal_sm),
            Paragraph(f"<b>Fecha:</b> {fecha_str} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Canal:</b> {inv['canal'].capitalize()}", normal_sm),
            Paragraph(f"<b>Cliente:</b> {html.escape(inv['nombre_cliente'])}", normal_sm),
        ]
        if inv.get('numero_pedido'):
            elements.append(Paragraph(f"<b>Pedido asociado:</b> {inv['numero_pedido']}", normal_sm))
        elements.append(Spacer(1, 10))

        table_data = [['Producto', 'Cant.', 'P. Unit.', 'Subtotal']]
        for it in inv['items']:
            table_data.append([
                (it['nombre_producto'] or '')[:38],
                str(it['cantidad']),
                f"C$ {it['precio_unitario']:.2f}",
                f"C$ {it['subtotal']:.2f}"
            ])
        if len(table_data) == 1:
            table_data.append(['Venta general Shiny Skin', '1', f"C$ {inv['subtotal']:.2f}", f"C$ {inv['subtotal']:.2f}"])

        t = Table(table_data, colWidths=[175, 36, 68, 71])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1A4973')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('TOPPADDING', (0, 0), (-1, 0), 6),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#CBD5E1')),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 10))

        totals_data = [
            ['Subtotal:', f"C$ {inv['subtotal']:.2f}"],
        ]
        if inv['descuento'] > 0:
            totals_data.append(['Descuento:', f"-C$ {inv['descuento']:.2f}"])
        if inv['iva'] > 0:
            totals_data.append(['IVA:', f"C$ {inv['iva']:.2f}"])
        totals_data.append(['TOTAL:', f"C$ {inv['total']:.2f}"])
        if inv.get('monto_recibido'):
            totals_data.append(['Recibido:', f"C$ {inv['monto_recibido']:.2f}"])
            totals_data.append(['Cambio:', f"C$ {inv['cambio']:.2f}"])

        tt = Table(totals_data, colWidths=[265, 85])
        tt.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]))
        elements.append(tt)
        elements.append(Spacer(1, 14))
        elements.append(Paragraph(
            'Precios finales conforme a Ley N.° 842 (Régimen Cuota Fija — Nicaragua). ¡Gracias por elegir Shiny Skin!',
            sub_style
        ))

        doc.build(elements)
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=request.args.get('download') == '1',
            download_name=f"{inv['numero_factura']}.pdf"
        )
    except Exception:
        # Respaldo HTML imprimible si ReportLab no está instalado en el intérprete actual
        rows = ''.join(
            f"<tr><td>{html.escape(it['nombre_producto'])}</td><td style='text-align:center'>{it['cantidad']}</td>"
            f"<td style='text-align:right'>C$ {it['precio_unitario']:.2f}</td>"
            f"<td style='text-align:right'>C$ {it['subtotal']:.2f}</td></tr>"
            for it in inv['items']
        ) or f"<tr><td>Venta Shiny Skin</td><td style='text-align:center'>1</td><td style='text-align:right'>C$ {inv['subtotal']:.2f}</td><td style='text-align:right'>C$ {inv['subtotal']:.2f}</td></tr>"

        html_doc = f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Comprobante {inv['numero_factura']} - Shiny Skin</title>
        <style>
          body{{font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:24px auto;padding:24px;color:#1e293b;border:1px solid #cbd5e1;border-radius:12px}}
          h1{{margin:0;color:#1a4973;font-size:20px}} .muted{{color:#64748b;font-size:12px;margin-bottom:14px}}
          table{{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}}
          th{{background:#1a4973;color:#fff;padding:7px;text-align:left}} td{{padding:7px;border-bottom:1px solid #e2e8f0}}
          .tot{{text-align:right;font-size:14px;margin-top:10px}} .grand{{font-size:18px;font-weight:700;color:#1a4973}}
          @media print{{.no-print{{display:none}} body{{border:none;margin:0}}}}
        </style></head><body>
        <div class="no-print" style="text-align:right;margin-bottom:10px"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
        <h1>SHINY SKIN</h1>
        <div class="muted">Concept Store · Camino de Oriente, Managua, Nicaragua</div>
        <div><strong>Factura:</strong> {inv['numero_factura']} &nbsp;|&nbsp; <strong>Estado:</strong> {inv['estado'].upper()}</div>
        <div><strong>Fecha:</strong> {fecha_str} &nbsp;|&nbsp; <strong>Pago:</strong> {inv['metodo_pago']}</div>
        <div><strong>Cliente:</strong> {html.escape(inv['nombre_cliente'])}</div>
        <table><thead><tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr></thead><tbody>{rows}</tbody></table>
        <div class="tot">
          <div>Subtotal: C$ {inv['subtotal']:.2f}</div>
          {f"<div>Descuento: -C$ {inv['descuento']:.2f}</div>" if inv['descuento'] > 0 else ""}
          <div class="grand">Total: C$ {inv['total']:.2f}</div>
        </div>
        <p class="muted" style="margin-top:18px;text-align:center">Precios finales conforme a Ley N.° 842 · ¡Gracias por tu compra!</p>
        </body></html>"""
        return Response(html_doc, mimetype='text/html')


@invoices_bp.route('/stats', methods=['GET'])
def invoice_stats():
    hoy = datetime.utcnow().date()
    total_facturas = Invoice.query.count()
    total_ingresos = db.session.query(func.sum(Invoice.total)).filter_by(estado='pagada').scalar() or 0
    ingresos_hoy = db.session.query(func.sum(Invoice.total)).filter(
        func.date(Invoice.fecha) == hoy,
        Invoice.estado == 'pagada'
    ).scalar() or 0
    pendientes = Invoice.query.filter_by(estado='emitida').count()
    anuladas = Invoice.query.filter_by(estado='anulada').count()
    return jsonify({
        'total_facturas': total_facturas,
        'total_ingresos': round(float(total_ingresos), 2),
        'ingresos_hoy': round(float(ingresos_hoy), 2),
        'pendientes_pago': pendientes,
        'anuladas': anuladas
    })
