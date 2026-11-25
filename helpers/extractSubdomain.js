export const extractSubdomain = (req) => {
    const origin = req.get("origin") || req.get("referer");
    if (!origin) return null;

    try {
        const { hostname } = new URL(origin); // e.g., "://domain.com.np" or ://localhost

        // Support local development (e.g., http://site1.localhost or http://localhost)
        if (hostname.endsWith("localhost")) {
            // const localParts = hostname.split(".");
            // return localParts.length > 1 ? localParts[0] : "main";
            return 'testevent'
        }

        // Ensure request comes from your own domain
        if (!hostname.endsWith(process.env.DOMAIN_NAME)) {
            return null;
        }

        // // Parse "://domain.com.np" (4 segments)
        // const parts = hostname.split(".");
        // if (parts.length > 3 && parts !== "www") {
        //     return parts[0]; // e.g., "site1"
        // }

        // return "main";
        return hostname.split('.')[0];
    } catch {
        return null;
    }
};