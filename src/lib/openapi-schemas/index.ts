import { addressSchemas } from './addresses/address.schema';
import { companySchemas } from './compagnies/compagny.schema';
import { currencySchemas } from './currencies/currency.schema';
import { productCategorySchemas } from './product-categories/product-category.schema';
import { authorizationSchemas } from './users/authorization.schemas';
import { authSchemas } from './users/login.schemas';
import { userSchemas } from './users/user.schemas';

export const schemas = {
  ...userSchemas,
  ...authSchemas,
  ...authorizationSchemas,
  ...companySchemas,
  ...addressSchemas,
  ...currencySchemas,
  ...productCategorySchemas,
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
};
