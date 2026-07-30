// מייבא את מודול השרת של Node.js
const http = require("http");

// מייבא פונקציות לעבודה עם קבצים
const fs = require("fs");

// מייבא פונקציות לעבודה עם נתיבים
const path = require("path");

// יוצר שרת HTTP
const server = http.createServer((req, res) => {

    // מסיר פרמטרים מהכתובת (אם קיימים)
    let url = req.url.split("?")[0];

    // אם ביקשו את דף הבית
    if (url === "/") {
        url = "/index.html";
    }

    // בודק האם אין סיומת לקובץ
    if (!path.extname(url)) {

        // מנסה קודם קובץ בשם xxx.html
        const htmlFile = path.join(__dirname, url + ".html");

        // אם קיים קובץ כזה משתמשים בו
        if (fs.existsSync(htmlFile)) {
            url += ".html";
        } else {

            // אחרת מנסים תיקייה עם index.html
            const indexFile = path.join(__dirname, url, "index.html");

            if (fs.existsSync(indexFile)) {
                url = path.join(url, "index.html");
            }
        }
    }

    // הנתיב המלא לקובץ
    const filePath = path.join(__dirname, url);

    // אם הקובץ לא קיים
    if (!fs.existsSync(filePath)) {

        // מחזיר 404
        res.writeHead(404, {
            "Content-Type": "text/plain; charset=utf-8"
        });

        // מציג הודעת שגיאה
        return res.end("404 Not Found");
    }

    // קובע Content-Type לפי הסיומת
    const types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".webp": "image/webp"
    };

    // בוחר את סוג הקובץ
    const contentType = types[path.extname(filePath)] || "application/octet-stream";

    // מחזיר את סוג הקובץ
    res.writeHead(200, {
        "Content-Type": contentType
    });

    // שולח את תוכן הקובץ
    fs.createReadStream(filePath).pipe(res);
});

// מפעיל את השרת על פורט 5500
server.listen(5500, () => {

    // Prints to the console
    console.log("Server running on http://127.0.0.1:5500");

});