import { addressSchemas } from './addresses/address.schema';
import { companySchemas } from './compagnies/compagny.schema';
import { currencySchemas } from './currencies/currency.schema';
import { productCategorySchemas } from './product-categories/product-category.schema';
import { authorizationSchemas } from './users/authorization.schemas';
import { authSchemas } from './users/login.schemas';
import { userSchemas } from './users/user.schemas';
import { customerGroupSchemas } from './customer-groups/customer-group.schema';
import { supplierSchemas } from './suppliers/supplier.schema';
import { customerSchemas } from './customers/customer.schema';
import { customerShippingAddressSchemas } from './customer-shipping-address/csa.schema';
import { paymentMethodSchemas } from './payment-methods/payment-method.schema';
import { warehouseSchemas } from './warehouses/warehouse.schema';
import { shopSchemas } from './shops/shop.schema';
import { bankAccountSchemas } from './bank-accounts/bank-account.schema';
import { cashRegisterSchemas } from './cash-registers/cash-register.schema';
import { cashRegisterSessionSchemas } from './cash-register-sessions/cash-register-session.schema';
import { quoteSchemas } from './quotes/quote.schema';
import { productSchemas } from './products/product.schema';
import { purchaseOrderSchemas } from './purchase-orders/purchase-order.schema';
import { purchaseReceptionSchemas } from './purchase-receptions/purchase-reception.schema';
import { salesOrderSchemas } from './sales-orders/sales-order.schema';
import { deliverySchemas } from './deliveries/delivery.schema';
import { stockMovementSchemas } from './stock-movements/stock-movement.schema';
import { supplierInvoiceSchemas } from './supplier-invoices/supplier-invoice.schema';

export const schemas = {
  ...userSchemas,
  ...authSchemas,
  ...authorizationSchemas,
  ...companySchemas,
  ...addressSchemas,
  ...currencySchemas,
  ...productCategorySchemas,
  ...customerGroupSchemas,
  ...supplierSchemas,
  ...customerSchemas,
  ...customerShippingAddressSchemas,
  ...paymentMethodSchemas,
  ...warehouseSchemas,
  ...shopSchemas,
  ...bankAccountSchemas,
  ...cashRegisterSchemas,
  ...cashRegisterSessionSchemas,
  ...quoteSchemas,
  ...productSchemas,
  ...purchaseOrderSchemas,
  ...purchaseReceptionSchemas,
  ...salesOrderSchemas,
  ...deliverySchemas,
  ...stockMovementSchemas,
  ...supplierInvoiceSchemas,
};

export const getOpenAPIComponents = (): { components: { schemas: typeof schemas } } => ({
  components: {
    schemas,
  },
});

export {
  userSchemas,
  authSchemas,
  authorizationSchemas,
  companySchemas,
  addressSchemas,
  currencySchemas,
  productCategorySchemas,
  customerGroupSchemas,
  supplierSchemas,
  customerSchemas,
  customerShippingAddressSchemas,
  paymentMethodSchemas,
  warehouseSchemas,
  shopSchemas,
  bankAccountSchemas,
  cashRegisterSchemas,
  cashRegisterSessionSchemas,
  productSchemas,
  quoteSchemas,
  purchaseOrderSchemas,
  purchaseReceptionSchemas,
  salesOrderSchemas,
  deliverySchemas,
  stockMovementSchemas,
  supplierInvoiceSchemas,
};
