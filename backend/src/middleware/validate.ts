import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'
import { ValidationError } from '../utils/errors.js'

type ValidationTarget = 'body' | 'query' | 'params'

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target])
    if (!result.success) {
      const messages = result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      )
      throw new ValidationError(messages.join('; '))
    }
    req[target] = result.data
    next()
  }
}
