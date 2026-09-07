from flask import Blueprint
routes_bp = Blueprint('routes', __name__)
from . import products, orders, invoices, inventory, auth, dashboard
