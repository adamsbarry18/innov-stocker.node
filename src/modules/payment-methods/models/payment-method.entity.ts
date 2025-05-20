import { Entity, Column, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model'; // Ajustez le chemin

// Enum pour les types de méthodes de paiement, aligné avec le SQL VARCHAR/ENUM
// Le SQL utilise VARCHAR, donc nous validons contre ces chaînes.
export enum PaymentMethodType {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  CARD = 'card',
  OTHER = 'other',
}

// Zod Schema for validation
const paymentMethodSchemaValidation = z.object({
  name: z.string().min(1, { message: 'Payment method name is required.' }).max(100),
  type: z.nativeEnum(PaymentMethodType, {
    errorMap: () => ({ message: 'Invalid payment method type.' }),
  }),
  isActive: z.boolean().optional().default(true),
});

// Type for creating a payment method
export type CreatePaymentMethodInput = z.infer<typeof paymentMethodSchemaValidation>;

// Type for updating a payment method (all fields optional)
export type UpdatePaymentMethodInput = Partial<CreatePaymentMethodInput>;

// Type for API response (DTO)
export type PaymentMethodApiResponse = {
  id: number;
  name: string;
  type: PaymentMethodType;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export const paymentMethodValidationInputErrors: string[] = [];

@Entity({ name: 'payment_methods' })
@Unique(['name']) // Name must be unique
export class PaymentMethod extends Model {
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({
    type: 'varchar', // Ou 'enum' si votre SQL utilise ENUM et TypeORM est configuré pour
    length: 20, // La longueur doit correspondre à la plus longue valeur de l'enum type
    // enum: PaymentMethodType, // Optionnel si type est VARCHAR, mais bon pour la clarté
  })
  type!: PaymentMethodType;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean = true;

  /**
   * Formats the entity for an API response.
   * @returns The formatted object for API.
   */
  toApi(): PaymentMethodApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      name: this.name,
      type: this.type,
      isActive: this.isActive,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  /**
   * Validates the entity's attributes using Zod.
   * @returns True if valid, false otherwise. Errors are stored in paymentMethodValidationInputErrors.
   */
  isValid(): boolean {
    const result = paymentMethodSchemaValidation.safeParse(this);
    paymentMethodValidationInputErrors.length = 0;

    if (!result.success) {
      paymentMethodValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
