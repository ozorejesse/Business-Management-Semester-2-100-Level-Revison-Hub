import crypto from "crypto";
import {
    issueSignedToken,
    presignUrl
} from "@vercel/blob";

const SESSION_MAX_AGE =
    2 * 60 * 60 * 1000;

const MAX_FILE_SIZE =
    50 * 1024 * 1024;


function verifyAdminSession(session) {

    if (
        !session ||
        !process.env.ADMIN_CODE
    ) {
        return false;
    }


    const parts =
        session.split(".");


    if (parts.length !== 2) {
        return false;
    }


    const [
        timestamp,
        signature
    ] = parts;


    const timestampNumber =
        Number(timestamp);


    if (!timestampNumber) {
        return false;
    }


    if (
        Date.now() - timestampNumber >
            SESSION_MAX_AGE ||
        timestampNumber >
            Date.now() + 60 * 1000
    ) {
        return false;
    }


    const expectedSignature =
        crypto
            .createHmac(
                "sha256",
                process.env.ADMIN_CODE
            )
            .update(timestamp)
            .digest("hex");


    try {

        return crypto.timingSafeEqual(
            Buffer.from(
                signature,
                "utf8"
            ),
            Buffer.from(
                expectedSignature,
                "utf8"
            )
        );

    } catch {

        return false;

    }
}


function slugify(value) {

    return String(value)
        .toLowerCase()
        .trim()
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            "");

}


export default async function handler(
    request,
    response
) {

    if (request.method !== "POST") {

        return response
            .status(405)
            .json({
                error:
                    "Method not allowed."
            });

    }


    try {

        const body =
            request.body || {};


        const {
            session,
            pathname,
            course,
            week
        } = body;


        /*
         * Verify admin login
         */

        if (
            !verifyAdminSession(
                session
            )
        ) {

            return response
                .status(401)
                .json({
                    error:
                        "Admin login required or session expired."
                });

        }


        /*
         * Validate upload information
         */

        if (
            !pathname ||
            !course ||
            !week
        ) {

            return response
                .status(400)
                .json({
                    error:
                        "Missing upload information."
                });

        }


        /*
         * Only allow our resource folders.
         */

        const expectedPrefix =
            `resources/${slugify(course)}/${slugify(week)}/`;


        if (
            !pathname.startsWith(
                expectedPrefix
            )
        ) {

            return response
                .status(400)
                .json({
                    error:
                        "Invalid resource path."
                });

        }


        if (
            !pathname
                .toLowerCase()
                .endsWith(".pdf")
        ) {

            return response
                .status(400)
                .json({
                    error:
                        "Only PDF files are allowed."
                });

        }


        /*
         * Create a short-lived
         * OIDC-backed signed upload token.
         *
         * This is the important part:
         * no BLOB_READ_WRITE_TOKEN is required.
         */

        const validUntil =
            Date.now() +
            15 * 60 * 1000;


        const signedToken =
            await issueSignedToken({

                pathname,

                operations: [
                    "put"
                ],

                validUntil,

                allowedContentTypes: [
                    "application/pdf"
                ],

                maximumSizeInBytes:
                    MAX_FILE_SIZE

            });


        /*
         * Turn the signed token into
         * a temporary browser upload URL.
         */

        const {
            presignedUrl
        } = await presignUrl(
            signedToken,
            {

                pathname,

                operation:
                    "put",

                validUntil,

                allowedContentTypes: [
                    "application/pdf"
                ],

                maximumSizeInBytes:
                    MAX_FILE_SIZE,

                access:
                    "public"

            }
        );


        return response
            .status(200)
            .json({

                success: true,

                presignedUrl

            });


    } catch (error) {

        console.error(
            "Blob upload error:",
            error
        );


        return response
            .status(500)
            .json({

                error:
                    error?.message ||
                    "Unable to prepare upload."

            });

    }

}
