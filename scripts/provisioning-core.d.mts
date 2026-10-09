export const slugPattern: RegExp;
export const domainPattern: RegExp;
export const supabaseRegions: Set<string>;
export const operatorOnlyKeys: Set<string>;
export const sensitiveRuntimeKeys: Set<string>;
export const runtimeSecretKeys: Set<string>;
export const secretSkeleton: Record<string, string>;

export type DeploymentManifest = Record<string, unknown> & {
  schemaVersion: number;
  slug: string;
  appUrl: string;
  vercel: Record<string, unknown> & {
    projectName: string;
    scope: string;
    projectId: string;
    orgId: string;
    customDomain: string;
  };
  supabase: Record<string, unknown> & {
    projectName: string;
    organizationId: string;
    projectRef: string;
    region: string;
    size: string;
  };
  providers: Record<string, unknown> & {
    payment: string;
    flowEnvironment: string;
    email: string;
    whatsappBotEnabled: boolean;
  };
};

export function validateDeployment(deployment: unknown, expectedSlug?: string): DeploymentManifest;
export function normalizeDomain(value: unknown): string;
export function configureDeploymentDomain(deployment: DeploymentManifest, value: unknown): DeploymentManifest;
export function readJson(path: string): DeploymentManifest;
export function parseEnv(text: string): Record<string, string>;
export function serializeEnv(values: Record<string, string>, heading?: string): string;
export function environmentFromEdition(
  edition: Record<string, unknown>,
  deployment: Record<string, unknown>,
  secrets?: Record<string, string>,
): Record<string, string>;
export function validateProvisioningReadiness(
  deployment: Record<string, unknown>,
  secrets: Record<string, string>,
  stage?: string,
): { errors: string[]; warnings: string[] };
export function deploymentPaths(projectRoot: string, slug: string): {
  edition: string;
  deployment: string;
  secrets: string;
  report: string;
  work: string;
};
export function createPlan(deployment: Record<string, unknown>): string[];
