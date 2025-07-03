import { BaseRouter } from '@/common/routing/BaseRouter';
import { CompanyService } from './services/company.service';
import { authorize, Get, Put } from '@/common/routing/decorators';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { NextFunction, Response, Request } from '@/config/http';

export default class CompanyRouter extends BaseRouter {
  companyService = CompanyService.getInstance();

  /**
   * @openapi
   * /companies:
   *   get:
   *     summary: Get all companies
   *     tags:
   *       - Company
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of companies
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/CompanyApiResponse'
   *       403:
   *         description: Forbidden
   *
   */
  @Get('/companies')
  @authorize({ level: SecurityLevel.READER })
  async getAllCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.pipe(res, req, next, () => this.companyService.getAllCompanies());
  }

  /**
   * @openapi
   * /company/{id}:
   *   get:
   *     summary: Get company information by ID
   *     tags:
   *       - Company
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: The company ID
   *     responses:
   *       200:
   *         description: Company information
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CompanyApiResponse'
   *       404:
   *         description: Company information not found
   *
   */
  @Get('/company/:id')
  @authorize({ level: SecurityLevel.READER })
  async getCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    const companyId = parseInt(req.params.id, 10);
    await this.pipe(res, req, next, () => this.companyService.getCompanyDetails(companyId));
  }

  /**
   * @openapi
   * /company/{id}:
   *   put:
   *     summary: Update company information
   *     tags:
   *       - Company
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: The company ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCompanyInput'
   *     responses:
   *       200:
   *         description: Company information updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CompanyApiResponse'
   *       400:
   *         description: Invalid data
   *       403:
   *         description: Forbidden
   *
   */
  @Put('/company/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async updateCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    const companyId = parseInt(req.params.id, 10);
    const companyInput = req.body;
    await this.pipe(res, req, next, () =>
      this.companyService.updateCompanyDetails(companyId, companyInput),
    );
  }
}
