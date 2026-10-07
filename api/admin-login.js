import crypto from "crypto";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { code } = req.body || {};

        if (!code) {
            return res.status(400).json({
                error: "Admin code is required."
            });
        }

        if (code !== process.env.ADMIN_CODE) {
            return res.status(401).json({
                error: "Incorrect admin code."
            });
        }

        const timestamp = Date.now().toString();

        const signature = crypto
            .createHmac("sha256", process.env.ADMIN_CODE)
            .update(timestamp)
            .digest("hex");

        const session = `${timestamp}.${signature}`;

        return res.status(200).json({
            success: true,
            session
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Unable to process login."
        });
    }
}
