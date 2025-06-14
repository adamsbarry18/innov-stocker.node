import { CustomerReturnRepository } from './data/customer-return.repository';
import {
  CustomerReturn,
  CustomerReturnStatus,
  CreateCustomerReturnInput,
  UpdateCustomerReturnInput,
  CustomerReturnApiResponse,
  customerReturnValidationInputErrors,
  ApproveReturnInput,
  ReceiveReturnInput,
  CompleteReturnInput,
} from './models/customer-return.entity';
import { CustomerReturnService } from './services/customer-return.service';
import {
  CreateCustomerReturnItemInput,
  CustomerReturnItem,
  CustomerReturnItemApiResponse,
  customerReturnItemValidationInputErrors,
  ReturnedItemCondition,
  ReturnItemActionTaken,
  createCustomerReturnItemSchema,
} from './customer-return-items/models/customer-return-item.entity';

export {
  CustomerReturn,
  CustomerReturnRepository,
  CustomerReturnService,
  // Types, enums, and constants
  CustomerReturnStatus,
  CreateCustomerReturnInput,
  UpdateCustomerReturnInput,
  CustomerReturnApiResponse,
  customerReturnValidationInputErrors,
  ApproveReturnInput,
  ReceiveReturnInput,
  CompleteReturnInput,
  // Return Item Types/Entities
  CreateCustomerReturnItemInput,
  CustomerReturnItem,
  CustomerReturnItemApiResponse,
  customerReturnItemValidationInputErrors,
  ReturnedItemCondition,
  ReturnItemActionTaken,
  createCustomerReturnItemSchema,
};
