import { Controller, Get, Query } from '@nestjs/common';
import { graphQuerySchema } from '@docmax/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GraphService } from './graph.service';

/** TZ-2 §2.3 — barcha rollarga ochiq (o'qish). ACL (§2.5) kelgach papka filtri qamrab oladi. */
@Controller('graph')
export class GraphController {
  constructor(private readonly graph: GraphService) {}

  @Get()
  build(@Query(new ZodValidationPipe(graphQuerySchema)) query: unknown) {
    return this.graph.build(query as never);
  }
}
