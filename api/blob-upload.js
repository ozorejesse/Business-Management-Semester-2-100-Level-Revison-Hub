import crypto from "crypto";
import { handleUpload } from "@vercel/blob/client";

const SESSION_MAX_AGE = 2 * 60 * 60 * 1000;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function verifyAdminSession(session) {
    if (!session || !process.env.ADMIN_CODE) {
        return false;
    }

    const parts = session.split(".");

    if (parts.length !== 2) {
        return false;
    }

    const [timestamp, signature] = parts;
    const timestampNumber = Number(timestamp);

    if (!timestampNumber) {
        return false;
    }

    if (
        Date.now() - timestampNumber > SESSION_MAX_AGE ||
        timestampNumber > Date.now() + 60 * 1000
    ) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.ADMIN_CODE)
        .update(timestamp)
        .digest("hex");

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, "utf8"),
            Buffer.from(expectedSignature, "utf8")
        );
    } catch {
        return false;
    }
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function cleanResourceName(name) {
    return String(name || "")
        .trim()
        .replace(/\.pdf$/i, "")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
        .replace(/\s+/g, " ")
        .slice(0, 150);
}

export default async function handler(request) {
    if (request.method !== "POST") {
        return new Response(
            JSON.stringify({
                error: "Method not allowed."
            }),
            {
                status: 405,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }

    try {
        const body = await request.json();

        const clientPayload =
            body?.payload?.clientPayload;

        let payload;

        try {
            payload = JSON.parse(
                clientPayload || "{}"
            );
        } catch {
            throw new Error(
                "Invalid upload information."
            );
        }

        if (!verifyAdminSession(payload.session)) {
            return new Response(
                JSON.stringify({
                    error:
                        "Admin login required or session expired."
                }),
                {
                    status: 401,
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }

        const jsonResponse =
            await handleUpload({
                body,
                request,

                onBeforeGenerateToken:
                    async (
                        pathname,
                        incomingPayload,
                        multipart
                    ) => {

                        let uploadData;

                        try {
                            uploadData = JSON.parse(
                                incomingPayload || "{}"
                            );
                        } catch {
                            throw new Error(
                                "Invalid upload information."
                            );
                        }

                        if (
                            !verifyAdminSession(
                                uploadData.session
                            )
                        ) {
                            throw new Error(
                                "Admin login required or session expired."
                            );
                        }

                        if (
                            !uploadData.course ||
                            !uploadData.week ||
                            !uploadData.resourceName
                        ) {
                            throw new Error(
                                "Course, week and resource name are required."
                            );
                        }

                        const resourceName =
                            cleanResourceName(
                                uploadData.resourceName
                            );

                        if (!resourceName) {
                            throw new Error(
                                "A valid resource name is required."
                            );
                        }

                        const expectedPrefix =
                            `resources/${slugify(
                                uploadData.course
                            )}/${slugify(
                                uploadData.week
                            )}/`;

                        if (
                            typeof pathname !== "string" ||
                            !pathname.startsWith(
                                expectedPrefix
                            ) ||
                            !pathname
                                .toLowerCase()
                                .endsWith(".pdf")
                        ) {
                            throw new Error(
                                "Invalid resource upload path."
                            );
                        }

                        return {
                            allowedContentTypes: [
                                "application/pdf"
                            ],

                            maximumSizeInBytes:
                                MAX_FILE_SIZE,

                            multipart:
                                Boolean(multipart),

                            addRandomSuffix:
                                false,

                            tokenPayload:
                                JSON.stringify({
                                    course:
                                        uploadData.course,
                                    week:
                                        uploadData.week,
                                    resourceName
                                })
                        };
                    },

                onUploadCompleted:
                    async ({
                        blob,
                        tokenPayload
                    }) => {

                        console.log(
                            "Resource uploaded:",
                            blob.url,
                            tokenPayload
                        );
                    }
            });

        return new Response(
            JSON.stringify(jsonResponse),
            {
                status: 200,
                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );

    } catch (error) {

        console.error(
            "Blob upload error:",
            error
        );

        return new Response(
            JSON.stringify({
                error:
                    error?.message ||
                    "Upload failed."
            }),
            {
                status: 400,
                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );
    }
}
