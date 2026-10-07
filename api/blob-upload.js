import { put } from "@vercel/blob";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const session = req.headers["x-admin-session"];

        if (!session) {
            return res.status(401).json({
                error: "Admin login required."
            });
        }

        const {
            course,
            week,
            resourceName
        } = req.body || {};

        if (!course || !week || !resourceName) {
            return res.status(400).json({
                error: "Course, week and resource name are required."
            });
        }

        const sessionParts = session.split(".");
        if (sessionParts.length !== 2) {
            return res.status(401).json({
                error: "Invalid admin session."
            });
        }

        const timestamp = Number(sessionParts[0]);

        if (
            !timestamp ||
            Date.now() - timestamp > 2 * 60 * 60 * 1000
        ) {
            return res.status(401).json({
                error: "Admin session expired."
            });
        }

        const file = req.body.file;

        if (!file) {
            return res.status(400).json({
                error: "PDF file is required."
            });
        }

        const blob = await put(
            `resources/${course}/${week}/${resourceName}.pdf`,
            file,
            {
                access: "public",
                addRandomSuffix: true
            }
        );

        return res.status(200).json({
            success: true,
            url: blob.url,
            pathname: blob.pathname
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Unable to upload resource."
        });
    }
}
