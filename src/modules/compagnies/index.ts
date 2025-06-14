import { CompanyRepository } from './data/company.repository';
import {
  Company,
  companyValidationInputErrors,
  type CompanyApiResponse,
  type UpdateCompanyInput,
  // Ajoute d'autres types/constantes utiles ici si besoin
} from './models/company.entity';
import { CompanyService } from './services/compagny.service';

export {
  Company,
  companyValidationInputErrors,
  type CompanyApiResponse,
  type UpdateCompanyInput,
  CompanyRepository,
  CompanyService,
};
