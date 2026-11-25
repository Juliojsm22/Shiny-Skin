# SISCO — Sistema Web de Ventas e Inventario Omnicanal para Shiny Skin

Sistema de información web desarrollado para la microempresa **Shiny Skin** (Concept Store, Camino de Oriente, Managua, Nicaragua), especializada en la comercialización omnicanal de cosméticos coreanos (*K-Beauty*) y cuidado de la piel (*Skincare*).

---

## Arquitectura Tecnológica

| Capa | Tecnología |
|------|------------|
| **Frontend** | HTML5, CSS3 responsivo (Mobile-First, contraste WCAG AA), JavaScript ES6+ |
| **Backend** | Python 3 + Flask 3.0 + SQLAlchemy ORM + Flask-JWT-Extended + ReportLab |
| **Base de Datos** | SQLite 3 (desarrollo local) / PostgreSQL en Supabase (producción) |
| **Despliegue** | Gunicorn + Render (`Procfile` y `render.yaml` incluidos) |

---

## Módulos Implementados

1. **Tienda E-Commerce Pública (`/` y `/tienda.html`)**
   - Catálogo interactivo con filtros dinámicos por línea (*Skincare* / *Makeup*), subcategoría, marca, precio, novedades y ofertas.
   - Ficha detallada de producto con ingredientes, beneficios, tamaño, tono, disponibilidad en tiempo real y recomendaciones.
   - Carrito persistente con control estricto de stock máximo disponible.
   - Checkout sin registro obligatorio (*NFR-0017*), soporte de entrega a domicilio o retiro en Concept Store, cálculo de cambio para pago contra entrega y seguimiento público de pedidos por código (`SS-XXXXXX`).
   - Cumplimiento de precios finales visibles conforme a la **Ley N.° 842** (Protección de los Derechos de las Personas Consumidoras y Usuarias — Nicaragua).

2. **Punto de Venta (POS) y Facturación (`/admin/facturacion.html`)**
   - Facturación directa en Concept Store con buscador de productos/SKU, descuentos por monto o porcentaje, cálculo automático de vuelto, vinculación con pedidos web/WhatsApp, anulación con devolución automática de stock y descarga/impresión de comprobante PDF.

3. **Gestión de Productos e Inventario Dual (`/admin/productos.html`, `/admin/inventario.html`)**
   - Separación y sincronización entre **Stock Tienda Física** (*Concept Store*) y **Stock Online**, traslados entre ubicaciones, entradas de mercadería, salidas por merma/daño, ajustes auditados, calculadora de precio sugerido según costo + margen, alertas de stock mínimo y vencimiento, y reporte de rotación (*HU-11*).

4. **Pedidos Omnicanal y Motorizados (`/admin/pedidos.html`)**
   - Gestión de pedidos provenientes de Web, WhatsApp, Instagram y Tienda Física, registro manual con selector de productos, asignación de motorizados de entrega, historial de estados y devolución automática de inventario al cancelar.

5. **Cartera de Clientes, Gastos Operativos, Usuarios y Dashboard (`/admin/clientes.html`, `/admin/gastos.html`, `/admin/usuarios.html`, `/admin/dashboard.html`)**
   - Cartera automática de clientes e historial de compras (*HU-05*), control de gastos por categoría (*HU-13*), administración de usuarios y roles `admin` / `vendedor` (*HU-14*), recuperación de contraseña (*FRQ-0004*) y KPIs financieros en tiempo real.

---

## Instalación, Acceso Multi-Dispositivo y Alertas en Tiempo Real

### 1. En tienda / red local Wi-Fi (varios celulares + PC de caja)
```bash
cd sisco-shinyskin/backend
pip install -r requirements.txt
python app.py
```
O simplemente ejecuta `iniciar_servidor.bat`. Al arrancar mostrará dos direcciones:
- **PC de caja:** `http://localhost:5000`
- **Celulares / tablets en el mismo Wi-Fi:** `http://<IP-DE-TU-PC>:5000`

### 2. En Internet desde cualquier lugar del mundo (Render + PostgreSQL)
- Despliega este repositorio en **Render** usando el `render.yaml` incluido (sirve tanto la tienda pública como el panel admin y el canal en tiempo real SSE).
- Configura la variable `DATABASE_URL` (PostgreSQL en Supabase o Render) para persistencia permanente.
- Si además publicas el frontend en **GitHub Pages**, coloca la URL de tu servidor Render en `frontend/js/config.js` (`API_SERVER_URL: 'https://tu-app.onrender.com'`).

### Alertas en Tiempo Real de Nuevos Pedidos
Cada vez que un cliente realiza un pedido desde cualquier dispositivo, el Panel Administrativo muestra de inmediato:
- Tarjeta flotante animada con datos completos del cliente, productos, vuelto y botones de **Confirmar Ahora** / **WhatsApp**.
- Franja persistente superior mientras existan pedidos pendientes.
- Alerta sonora (Web Audio API), parpadeo de pestaña y notificación de escritorio (Windows/Android/macOS).

### Credenciales de Prueba

| Rol | Correo | Usuario | Contraseña |
|-----|--------|---------|------------|
| **Administradora** | `admin@shinyskin.ni` | `admin` | `admin123` |
| **Vendedora** | `ventas@shinyskin.ni` | `ventas` | `ventas123` |

---

## Autores

- **Br. Julio César Sánchez Carrión**
- **Br. Valeska Yamileth Martínez Sánchez**
- *Universidad Nacional de Ingeniería (UNI) — Ingeniería de Sistemas, Managua, Nicaragua (2026)*

