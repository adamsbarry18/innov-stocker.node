import { addressSchemas } from './addresses/address.schema';
import { companySchemas } from './compagnies/compagny.schema';
import { currencySchemas } from './currencies/currency.schema';
import { productCategorySchemas } from './product-categories/product-category.schema';
import { authorizationSchemas } from './users/authorization.schemas';
import { authSchemas } from './users/login.schemas';
import { userSchemas } from './users/user.schemas';
import { customerGroupSchemas } from './customer-groups/customer-group.schema';
import { supplierSchemas } from './suppliers/supplier.schema';

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
};
