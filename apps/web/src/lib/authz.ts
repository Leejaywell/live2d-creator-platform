import { getCurrentSession } from "@/auth";
import { hasPermission, isAdminRole, Permission } from "@/lib/permissions";

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session?.user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  if (session.user.status !== "active") {
    throw new Response("Account suspended", { status: 403 });
  }
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, permission)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return session;
}

export async function requireAdminRole() {
  const session = await requireSession();
  if (!isAdminRole(session.user.role)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return session;
}
