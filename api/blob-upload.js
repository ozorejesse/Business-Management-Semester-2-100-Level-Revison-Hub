import crypto from "crypto";
import { issueSignedToken, presignUrl } from "@vercel/blob";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SESSION_MAX_AGE = 2 * 60 * 60 * 1000;

function verifySession(session) {
    if (!session || !process.env.ADMIN_CODE) {
        return false;
    }

    const parts = session.split(".");

    if (parts.length !== 2) {
        return false;
    }

    const timestamp = Number(parts[0]);
    const signature = parts[1];

    if (!timestamp || !signature) {
        return false;
    }

    const age = Date.now() - timestamp;

    if (age < 0 || age > SESSION_MAX_AGE) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.ADMIN_CODE)
        .update(String(timestamp))
        .digest("hex");

    if (signature.length !== expectedSignature.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

function slugify(value) {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export default async function handler(request) {
    if (request.method !== "POST") {
        return Response.json(
            { error: "Method not allowed" },
            { status: 405 }
        );
    }

    try {
        const {
            session,
            course,
            week,
            resourceName,
            fileSize
        } = await request.json();

        if (!verifySession(session)) {
            return Response.json(
                { error: "Invalid or expired admin session." },
                { status: 401 }
            );
        }

        if (!course || !week || !resourceName) {
            return Response.json(
                {
                    error:
                        "Course, week and resource name are required."
                },
                { status: 400 }
            );
        }

        if (!fileSize || fileSize <= 0) {
            return Response.json(
                { error: "A PDF file is required." },
                { status: 400 }
            );
        }

        if (fileSize > MAX_FILE_SIZE) {
            return Response.json(
                {
                    error:
                        "PDF is too large. Maximum file size is 25 MB."
                },
                { status: 400 }
            );
        }

        const pathname =
            `resources/${slugify(course)}/` +
            `${slugify(week)}/` +
            `${Date.now()}-${crypto.randomUUID()}-` +
            `${slugify(resourceName)}.pdf`;

        const validUntil =
            Date.now() + 15 * 60 * 1000;

        const token = await issueSignedToken({
            pathname,
            operations: ["put"],
            validUntil,
            allowedContentTypes: ["application/pdf"],
            maximumSizeInBytes: MAX_FILE_SIZE
        });

        const { presignedUrl } = await presignUrl(token, {
            pathname,
            operation: "put",
            validUntil
        });

        const publicUrl = new URL(presignedUrl);
        publicUrl.search = "";

        return Response.json({
            success: true,
            presignedUrl,
            url: publicUrl.toString(),
            pathname
        });

    } catch (error) {
        console.error(error);

        return Response.json(
            {
                error:
                    error.message ||
                    "Unable to prepare upload."
            },
            { status: 500 }
        );
    }
}
