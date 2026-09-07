from flask import Blueprint, jsonify, request
from models import db, Invoice, Order
from datetime import datetime
import random, string

invoices_bp = Blueprint('invoices', __name__)


def generar_numero_factura():
    return 'FAC-' + datetime.now().strftime('%Y%m') + '-' + ''.join(random.choices(string.digits, k=4))


@invoices_bp.route('/', methods=['GET'])
def get_invoices():
    estado = request.args.get('estado')
    query = Invoice.query
    if estado:
        query = query.filter_by(estado=estado)
    invoices = query.order_by(Invoice.fecha.desc()).all()
    return jsonify([i.to_dict() for i in invoices])


@invoices_bp.route('/<int:id>', methods=['GET'])
def get_invoice(id):
    invoice = Invoice.query.get_or_404(id)
    return jsonify(invoice.to_dict())


@invoices_bp.route('/', methods=['POST'])
def create_invoice():
    data = request.get_json()
    order_id = data.get('order_id')
    order = None
    if order_id:
        order = Order.query.get(order_id)
    
    if order:
        invoice = Invoice(
            numero_factura=generar_numero_factura(),
            order_id=order.id,
            nombre_cliente=order.nombre_cliente,
            email_cliente=order.email_cliente,
            subtotal=order.subtotal,
            descuento=order.descuento,
            iva=order.iva,
            total=order.total,
            notas=data.get('notas')
        )
    else:
        subtotal = data['subtotal']
        descuento = data.get('descuento', 0)
        iva = round((subtotal - descuento) * 0.15, 2)
        total = round(subtotal - descuento + iva, 2)
        invoice = Invoice(
            numero_factura=generar_numero_factura(),
            nombre_cliente=data['nombre_cliente'],
            email_cliente=data.get('email_cliente'),
            subtotal=subtotal, descuento=descuento, iva=iva, total=total,
            notas=data.get('notas')
        )

    db.session.add(invoice)
    db.session.commit()
    return jsonify(invoice.to_dict()), 201


@invoices_bp.route('/<int:id>/estado', methods=['PUT'])
def update_estado(id):
    invoice = Invoice.query.get_or_404(id)
    data = request.get_json()
    invoice.estado = data.get('estado', invoice.estado)
    db.session.commit()
    return jsonify(invoice.to_dict())


@invoices_bp.route('/stats', methods=['GET'])
def invoice_stats():
    from sqlalchemy import func
    total_facturas = Invoice.query.count()
    total_ingresos = db.session.query(func.sum(Invoice.total)).filter_by(estado='pagada').scalar() or 0
    pendientes = Invoice.query.filter_by(estado='emitida').count()
    return jsonify({
        'total_facturas': total_facturas,
        'total_ingresos': round(total_ingresos, 2),
        'pendientes_pago': pendientes
    })
