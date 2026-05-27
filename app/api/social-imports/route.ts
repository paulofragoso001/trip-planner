import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import {
  createSocialImport,
  listSocialImportWorkspace
} from "@/lib/server/social-imports";
import { validateCreateSocialImport } from "@/lib/validators/social-imports";

const routeName = "social-imports";

export async function GET() {
  try {
    const auth = await authorizeDashboardApi();

    if (!auth) {
      return unauthorized();
    }

    const workspace = await listSocialImportWorkspace(auth.supabase, auth.userId);
    return apiCanonicalSuccess(workspace);
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const parsed = contentType.includes("multipart/form-data")
      ? await readFormData(request)
      : { file: null, value: await readJson(request) };
    const validation = validateCreateSocialImport(parsed.value);

    if (!validation.ok) {
      return validationFailure("Invalid social import payload.", validation.details);
    }

    const auth = await authorizeDashboardApi();

    if (!auth) {
      return unauthorized();
    }

    const result = await createSocialImport(
      auth.supabase,
      auth.userId,
      validation.value,
      parsed.file
    );

    return apiCanonicalSuccess(result, { status: 201 });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function readFormData(request: Request) {
  const formData = await request.formData();
  const fileValue = formData.get("file");
  const value = {
    processNow: formData.get("processNow") !== "false",
    rawText: readFormString(formData, "rawText"),
    sourceCaption: readFormString(formData, "sourceCaption"),
    sourcePlatform: readFormString(formData, "sourcePlatform"),
    sourceTitle: readFormString(formData, "sourceTitle"),
    sourceUrl: readFormString(formData, "sourceUrl"),
    tripId: readFormString(formData, "tripId")
  };

  return {
    file: fileValue instanceof File && fileValue.size > 0 ? fileValue : null,
    value
  };
}

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}
