import { handleUpload } from "@vercel/blob/client";

export default async function handler(request) {
    if (request.method !== "POST") {
        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            {
                status: 405,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }

    try {
        const session = request.headers["x-admin-session"];

        if (!session) {
            return new Response(
                JSON.stringify({
                    error: "Admin login required."
                }),
                {
                    status: 401,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const body = await request.json();

        const jsonResponse = await handleUpload({
            body,
            request,

            onBeforeGenerateToken: async (
                pathname,
                clientPayload
            ) => {
                const sessionParts = session.split(".");

                if (sessionParts.length !== 2) {
                    throw new Error("Invalid admin session.");
                }

                const timestamp = Number(sessionParts[0]);

                if (
                    !timestamp ||
                    Date.now() - timestamp > 2 * 60 * 60 * 1000
                ) {
                    throw new Error("Admin session expired.");
                }

                let payload = {};

                try {
                    payload = JSON.parse(clientPayload || "{}");
                } catch {
                    throw new Error("Invalid upload information.");
                }

                if (
                    !payload.course ||
                    !payload.week ||
                    !payload.resourceName
                ) {
                    throw new Error(
                        "Course, week and resource name are required."
                    );
                }

                return {
                    allowedContentTypes: ["application/pdf"],
                    addRandomSuffix: true,
                    tokenPayload: JSON.stringify({
                        course: payload.course,
                        week: payload.week,
                        resourceName: payload.resourceName
                    })
                };
            },

            onUploadCompleted: async ({
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
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error) {
        console.error(error);

        return new Response(
            JSON.stringify({
                error: error.message || "Upload failed."
            }),
            {
                status: 400,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
}
