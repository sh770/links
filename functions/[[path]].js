// Cloudflare Pages Function שמבצעת בדיקת זמני פעילות לפני הצגת קישור מקוצר.
export async function onRequest(context) {
  // שומרים את הבקשה המקורית ואת כתובת האתר.
  const request = context.request;
  const url = new URL(request.url);

  // מאפשרים בקשות שאינן GET או HEAD לעבור ללא שינוי.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return context.next();
  }

  // לא מתערבים בדף הבית, בדף הניהול או בקבצים סטטיים.
  const path = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "");
  if (!path || path === "admin" || path === "admin.html" || path.includes("/") || path.includes(".")) {
    return context.next();
  }

  // טוענים את מסד הקישורים דרך שכבת הנכסים הסטטיים של Pages.
  let linksResponse;
  try {
    const linksUrl = new URL("/links.json", url);
    linksResponse = await context.env.ASSETS.fetch(new Request(linksUrl, { method: "GET" }));
    if (!linksResponse.ok) {
      throw new Error("links.json is unavailable");
    }
  } catch (error) {
    // במקרה של כשל בטעינת ההגדרות לא מאפשרים לעקוף את ההגבלה.
    return new Response("Unable to verify link schedule. Please try again later.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }

  // מפענחים את מסד הקישורים ומאתרים את הכינוי המבוקש.
  let links;
  try {
    links = await linksResponse.json();
  } catch (error) {
    // מסד נתונים פגום גורם לחסימה בטוחה.
    return new Response("Unable to verify link schedule. Please try again later.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }

  // מחפשים תחילה התאמה מדויקת ולאחר מכן התאמה ללא תלות באותיות גדולות וקטנות.
  const key = Object.prototype.hasOwnProperty.call(links, path)
    ? path
    : Object.keys(links).find((item) => item.toLowerCase() === path.toLowerCase());

  // אם הכינוי אינו קיים, מעבירים את הבקשה לטיפול הרגיל של דף 404.
  if (key === undefined) {
    return context.next();
  }

  // שולפים את הגדרת לוח הזמנים של הקישור.
  const schedule = links[key].schedule;

  // קישור ללא הגבלת זמן ממשיך להתנהג כרגיל.
  if (!schedule) {
    return context.next();
  }

  // מפיקים תאריך, שעה ויום בשבוע לפי אזור הזמן שהוגדר או לפי שעון ישראל.
  const timeZone = schedule.timezone || "Asia/Jerusalem";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23"
  }).formatToParts(new Date());

  // יוצרים פונקציה קצרה לשליפת רכיבי התאריך והשעה.
  const part = (type) => parts.find((item) => item.type === type)?.value || "";

  // מרכיבים תאריך ושעה בפורמט אחיד להשוואה.
  const today = part("year") + "-" + part("month") + "-" + part("day");
  const currentTime = part("hour") + ":" + part("minute");

  // ממירים את שם היום באנגלית למספר יום, כאשר יום ראשון הוא 0.
  const dayNumber = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[part("weekday")];

  // בודקים אם תאריך תחילת הפעילות עדיין לא הגיע.
  let blockMessage = "";
  if (schedule.startDate && today < schedule.startDate) {
    blockMessage = "הקישור עדיין לא פעיל. תאריך תחילת הפעילות: " + schedule.startDate;
  }

  // בודקים אם תאריך סיום הפעילות כבר עבר.
  if (!blockMessage && schedule.endDate && today > schedule.endDate) {
    blockMessage = "תוקף הקישור פג בתאריך " + schedule.endDate + ".";
  }

  // מכינים תיאור ברור של ימי ושעות הפעילות כדי שהמבקר ידע מתי לחזור.
  const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const activeDaysList = Array.isArray(schedule.days) && schedule.days.length
    ? schedule.days.map((day) => dayNames[day]).filter(Boolean)
    : [];
  // מציגים יום יחיד או רשימת ימים בניסוח עברי תקין.
  const formatActiveDays = (days) => {
    if (days.length === 1) return "ביום " + days[0];
    if (days.length === 2) return "בימי " + days[0] + " ו" + days[1];
    if (days.length > 2) return "בימי " + days.slice(0, -1).join(", ") + " ו" + days[days.length - 1];
    return "";
  };
  const activeDays = formatActiveDays(activeDaysList);
  const activeHours = schedule.startTime && schedule.endTime
    ? " בין השעות " + schedule.startTime + "–" + schedule.endTime
    : "";

  // בודקים אם היום הנוכחי אינו אחד מימי הפעילות שהוגדרו.
  if (!blockMessage && Array.isArray(schedule.days) && schedule.days.length && !schedule.days.includes(dayNumber)) {
    blockMessage = "הקישור אינו פעיל היום. ניתן להיכנס ב" + activeDays + activeHours + " (שעון ישראל).";
  }

  // אם עדיין מוקדם מדי, מציינים מאיזו שעה ניתן להיכנס היום.
  if (!blockMessage && schedule.startTime && schedule.endTime && currentTime < schedule.startTime) {
    blockMessage = "הקישור עדיין לא פעיל היום. אפשר להיכנס החל מהשעה " + schedule.startTime + " (שעון ישראל).";
  }

  // אם שעות הפעילות להיום הסתיימו, מציגים את חלון הפעילות הבא לפי ההגדרות.
  if (!blockMessage && schedule.startTime && schedule.endTime && currentTime >= schedule.endTime) {
    blockMessage = "שעות הפעילות להיום הסתיימו. ניתן להיכנס ב" +
      (activeDays || "ימי הפעילות המוגדרים") + activeHours + " (שעון ישראל).";
  }

  // אם הקישור פעיל, ממשיכים להתנהגות הקיימת של האתר.
  if (!blockMessage) {
    return context.next();
  }

  // מונעים שמירת תגובת חסימה במטמון כדי שההגבלה תיבדק בכל כניסה מחדש.
  const safeMessage = blockMessage.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  })[character]);

  // מציגים הודעת חסימה בעיצוב האתר, ללא הפניה אוטומטית.
  return new Response(
    `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>הקישור אינו פעיל</title><link rel="stylesheet" href="/style.css?v=20261112-5"></head><body><div class="center-page"><main class="box"><h1>הקישור חסום כרגע</h1><p>${safeMessage}</p></main></div></body></html>`,
    {
      status: 403,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}
