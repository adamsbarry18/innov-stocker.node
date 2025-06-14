import { CustomerRepository } from './data/customer.repository';
import { CustomerShippingAddressRepository } from './data/customer-shipping-address.repository';
import {
  Customer,
  customerValidationInputErrors,
  type CustomerApiResponse,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from './models/customer.entity';
import {
  CustomerShippingAddress,
  customerShippingAddressValidationInputErrors,
  type CustomerShippingAddressApiResponse,
  type CreateCustomerShippingAddressInput,
  type UpdateCustomerShippingAddressInput,
} from './models/customer-shipping-addresses.entity';
import { CustomerService } from './services/customer.service';

export {
  Customer,
  customerValidationInputErrors,
  type CustomerApiResponse,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  CustomerShippingAddress,
  customerShippingAddressValidationInputErrors,
  type CustomerShippingAddressApiResponse,
  type CreateCustomerShippingAddressInput,
  type UpdateCustomerShippingAddressInput,
  CustomerRepository,
  CustomerShippingAddressRepository,
  CustomerService,
};
