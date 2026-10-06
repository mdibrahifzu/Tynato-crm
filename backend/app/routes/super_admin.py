from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.dependencies import (
    get_db,
    require_super_admin,
)
from app.repositories.super_admin_repository import (
    create_audit_log,
    get_dashboard_stats,
    get_global_module,
    get_organization,
    list_audit_logs,
    list_global_modules,
    list_organizations,
    list_team_modules,
    list_users,
    update_global_module,
    update_organization_status,
    update_team_module,
)
from app.schemas.super_admin import (
    ModuleUpdateRequest,
    OrganizationStatusRequest,
)

router = APIRouter(
    prefix="/super-admin",
    tags=["Super Admin"],
)


@router.get("/access-check")
def access_check(
    current_user=Depends(require_super_admin),
):
    return {
        "success": True,
        "message": "Super Admin access verified",
        "user_id": str(current_user["id"]),
        "email": current_user["email"],
        "platform_role": current_user["platform_role"],
    }


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    return get_dashboard_stats(db)


@router.get("/organizations")
def organizations(
    search: str | None = Query(
        default=None,
        max_length=100,
    ),
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    return list_organizations(
        db=db,
        search=search,
    )


@router.get("/organizations/{team_id}")
def organization(
    team_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    result = get_organization(
        db=db,
        team_id=team_id,
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Organization not found.",
        )

    return result


@router.patch("/organizations/{team_id}/status")
def change_organization_status(
    team_id: UUID,
    payload: OrganizationStatusRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    try:
        organization = get_organization(
            db=db,
            team_id=team_id,
        )

        if not organization:
            raise HTTPException(
                status_code=404,
                detail="Organization not found.",
            )

        previous_status = organization["status"]

        if previous_status == payload.status:
            return organization

        updated = update_organization_status(
            db=db,
            team_id=team_id,
            status=payload.status,
        )

        if not updated:
            raise HTTPException(
                status_code=404,
                detail="Organization not found.",
            )

        create_audit_log(
            db,
            actor_user_id=current_user["id"],
            action="organization_status_changed",
            target_type="organization",
            target_id=team_id,
            before_data={
                "status": previous_status,
            },
            after_data={
                "status": payload.status,
            },
        )

        db.commit()

        return updated

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update organization status.",
        )


@router.get("/organizations/{team_id}/modules")
def organization_modules(
    team_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    organization = get_organization(
        db=db,
        team_id=team_id,
    )

    if not organization:
        raise HTTPException(
            status_code=404,
            detail="Organization not found.",
        )

    return list_team_modules(
        db=db,
        team_id=team_id,
    )


@router.patch(
    "/organizations/{team_id}/modules/{module_key}"
)
def change_organization_module(
    team_id: UUID,
    module_key: str,
    payload: ModuleUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    try:
        organization = get_organization(
            db=db,
            team_id=team_id,
        )

        if not organization:
            raise HTTPException(
                status_code=404,
                detail="Organization not found.",
            )

        module = get_global_module(
            db=db,
            module_key=module_key,
        )

        if not module:
            raise HTTPException(
                status_code=404,
                detail="Module not found.",
            )

        previous_modules = list_team_modules(
            db=db,
            team_id=team_id,
        )

        previous = next(
            (
                item
                for item in previous_modules
                if item["module_key"] == module_key
            ),
            None,
        )

        updated = update_team_module(
            db=db,
            team_id=team_id,
            module_key=module_key,
            is_enabled=payload.is_enabled,
        )

        create_audit_log(
            db,
            actor_user_id=current_user["id"],
            action="organization_module_changed",
            target_type="organization_module",
            target_id=team_id,
            before_data=(
                dict(previous)
                if previous
                else None
            ),
            after_data={
                "module_key": module_key,
                "team_enabled": updated["is_enabled"],
            },
        )

        db.commit()

        return updated

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update organization module.",
        )


@router.get("/modules")
def modules(
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    return list_global_modules(db)


@router.patch("/modules/{module_key}")
def change_global_module(
    module_key: str,
    payload: ModuleUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    try:
        module = get_global_module(
            db=db,
            module_key=module_key,
        )

        if not module:
            raise HTTPException(
                status_code=404,
                detail="Module not found.",
            )

        if module["is_enabled"] == payload.is_enabled:
            return module

        updated = update_global_module(
            db=db,
            module_key=module_key,
            is_enabled=payload.is_enabled,
        )

        create_audit_log(
            db,
            actor_user_id=current_user["id"],
            action="global_module_changed",
            target_type="module",
            target_id=None,
            before_data={
                "module_key": module_key,
                "is_enabled": module["is_enabled"],
            },
            after_data={
                "module_key": module_key,
                "is_enabled": updated["is_enabled"],
            },
        )

        db.commit()

        return updated

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update global module.",
        )


@router.get("/users")
def users(
    search: str | None = Query(
        default=None,
        max_length=100,
    ),
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    return list_users(
        db=db,
        search=search,
    )


@router.get("/audit-logs")
def audit_logs(
    limit: int = Query(
        default=100,
        ge=1,
        le=200,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
    current_user=Depends(require_super_admin),
):
    return list_audit_logs(
        db=db,
        limit=limit,
        offset=offset,
    )