import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Récupérer le tenantId depuis le header X-Tenant-Id ou depuis le JWT
    const tenantId = request.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      throw new BadRequestException('Header X-Tenant-Id manquant');
    }

    // Ajouter le tenantId à la requête pour utilisation dans les services
    request['tenantId'] = tenantId;
    
    return true;
  }
}




