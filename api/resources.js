import { list } from "@vercel/blob";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const blobs = [];

        let cursor;

        do {
            const result = await list({
                prefix: "resources/",
                cursor,
                limit: 1000
            });

            blobs.push(...result.blobs);

            cursor = result.hasMore
                ? result.cursor
                : undefined;

        } while (cursor);


        const resources = blobs
            .filter(blob =>
                blob.pathname.toLowerCase().endsWith(".pdf")
            )
            .map(blob => {

                const parts =
                    blob.pathname.split("/");

                const courseSlug = parts[1] || "";
                const weekSlug = parts[2] || "";

                const filename =
                    parts[3] || "Resource.pdf";


                const courseMap = {
                    "ams-102": "AMS 102",
                    "ams-104": "AMS 104",
                    "ams-108": "AMS 108",
                    "bua-102": "BUA 102",
                    "eco-102": "ECO 102",
                    "gst-112": "GST 112",
                    "gst-122": "GST 122"
                };


                const weekMap = {
                    "weeks-1-4": "Weeks 1–4",
                    "weeks-5-8": "Weeks 5–8",
                    "weeks-9-12": "Weeks 9–12"
                };


                let resourceName =
                    filename.replace(
                        /\.pdf$/i,
                        ""
                    );


                /*
                    Remove the timestamp and
                    random UUID from the filename.
                */

                resourceName =
                    resourceName.replace(
                        /^\d+-[a-f0-9-]{36}-/i,
                        ""
                    );


                resourceName =
                    resourceName
                        .replace(/-/g, " ")
                        .replace(/\b\w/g, char =>
                            char.toUpperCase()
                        );


                return {
                    course:
                        courseMap[courseSlug] ||
                        courseSlug,

                    week:
                        weekMap[weekSlug] ||
                        weekSlug,

                    resourceName,

                    url: blob.url,

                    filename,

                    size: blob.size,

                    uploadedAt:
                        blob.uploadedAt
                };

            });


        resources.sort(
            (a, b) =>
                new Date(b.uploadedAt) -
                new Date(a.uploadedAt)
        );


        return res.status(200).json({
            success: true,
            resources
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error:
                "Unable to load resources."
        });

    }
}
