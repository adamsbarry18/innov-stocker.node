import { BaseRouter } from '@/common/routing/BaseRouter';
import {
  Get,
  Post,
  Patch,
  authorize,
  paginate,
  sortable,
  filterable,
} from '../../common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import {
  OpenCashRegisterSessionInput,
  CloseCashRegisterSessionInput,
} from './models/cash-register-session.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { CashRegisterSessionService } from './services/cash-register-session.service';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class CashRegisterSessionRouter extends BaseRouter {
  service = CashRegisterSessionService.getInstance();

  /**
   * @openapi
   * /cash-register-sessions:
   *   get:
   *     summary: Get all cash register sessions
   *     tags:
   *       - Cash Register Sessions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: cashRegisterId
   *         in: query
   *         schema:
   *           type: integer
   *         description: Filter by cash register ID
   *       - name: openedByUserId
   *         in: query
   *         schema:
   *           type: integer
   *         description: Filter by user who opened the session
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *           enum: [open, closed]
   *         description: Filter by session status
   *       - name: dateFrom
   *         in: query
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter sessions opened on or after this date (YYYY-MM-DD)
   *       - name: dateTo
   *         in: query
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter sessions opened on or before this date (YYYY-MM-DD)
   *     responses:
   *       200:
   *         description: List of cash register sessions
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 sessions:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CashRegisterSessionApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Get('/cash-register-sessions')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'openingTimestamp', 'closingTimestamp', 'status', 'cashRegisterId'])
  @filterable(['cashRegisterId', 'openedByUserId', 'closedByUserId', 'status'])
  async getAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);
    await this.pipe(res, req, next, () =>
      this.service.findAll({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /cash-register-sessions/{id}:
   *   get:
   *     summary: Get a specific cash register session by its ID
   *     tags:
   *       - Cash Register Sessions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     responses:
   *       200:
   *         description: Cash register session found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CashRegisterSessionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/cash-register-sessions/:id')
  @authorize({ level: SecurityLevel.USER })
  async getSessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    await this.pipe(res, req, next, () => this.service.findById(id));
  }

  /**
   * @openapi
   * /cash-registers/{cashRegisterId}/sessions/active:
   *   get:
   *     summary: Get the current active session for a specific cash register
   *     tags:
   *       - Cash Register Sessions
   *       - Cash Registers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: cashRegisterId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID of the cash register
   *     responses:
   *       200:
   *         description: Active cash register session found, or null if none active
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CashRegisterSessionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Get('/cash-registers/:cashRegisterId/sessions/active')
  @authorize({ level: SecurityLevel.USER })
  async getActiveSessionByRegisterId(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const cashRegisterId = parseInt(req.params.cashRegisterId, 10);
    if (isNaN(cashRegisterId)) return next(new BadRequestError('Invalid Cash Register ID format.'));
    await this.pipe(res, req, next, () =>
      this.service.findActiveSessionByRegisterId(cashRegisterId),
    );
  }

  /**
   * @openapi
   * /cash-register-sessions/open:
   *   post:
   *     summary: Open a new cash register session
   *     tags:
   *       - Cash Register Sessions
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/OpenCashRegisterSessionInput'
   *     responses:
   *       201:
   *         description: Cash register session opened successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CashRegisterSessionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/cash-register-sessions/open')
  @authorize({ level: SecurityLevel.USER })
  async openSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: OpenCashRegisterSessionInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(res, req, next, () => this.service.openSession(input, userId), 201);
  }

  /**
   * @openapi
   * /cash-register-sessions/{id}/close:
   *   patch:
   *     summary: Close an active cash register session
   *     tags:
   *       - Cash Register Sessions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CloseCashRegisterSessionInput'
   *     responses:
   *       200:
   *         description: Cash register session closed successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CashRegisterSessionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/cash-register-sessions/:id/close')
  @authorize({ level: SecurityLevel.USER })
  async closeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const input: CloseCashRegisterSessionInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(res, req, next, () => this.service.closeSession(id, input, userId));
  }
}
