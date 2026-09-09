/**
 * Design Hub - pruebas automatizadas
 *
 * Requiere Jest + jsdom.
 * Este archivo prueba lógica que no depende directamente de la interfaz.
 *
 * Instalación:
 *   npm i -D jest jest-environment-jsdom
 *
 * Ejecución:
 *   npx jest
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

let appSource = "";

beforeAll(() => {
    const appPath = path.join(__dirname, "app.js");
    appSource = fs.readFileSync(appPath, "utf8");
});

function createAppContext() {
    const storage = new Map();

    const localStorageMock = {
        getItem(key) {
            return storage.has(key)
                ? storage.get(key)
                : null;
        },

        setItem(key, value) {
            storage.set(key, String(value));
        },

        removeItem(key) {
            storage.delete(key);
        },

        clear() {
            storage.clear();
        }
    };

    const context = {
        console,
        localStorage: localStorageMock,

        crypto: {
            randomUUID: jest.fn(() => "test-uuid-001")
        },

        URL,

        setTimeout,
        clearTimeout,

        window: {
            localStorage: localStorageMock
        },

        document: {
            getElementById: jest.fn(() => null),
            querySelector: jest.fn(() => null),
            querySelectorAll: jest.fn(() => [])
        }
    };

    vm.createContext(context);

    /*
     * app.js contiene inicialización de servicios y del DOM.
     * Para pruebas unitarias aislamos las funciones puras que
     * necesitamos validar.
     */
    vm.runInContext(
        `
        ${extractFunction(appSource, "escapeHTML")}
        ${extractFunction(appSource, "normalizeText")}
        ${extractFunction(appSource, "normalizeUsername")}
        ${extractFunction(appSource, "createId")}
        ${extractFunction(appSource, "isValidDateString")}
        ${extractFunction(appSource, "toBoolean")}
        ${extractFunction(appSource, "isSafeHttpUrl")}
        ${extractFunction(appSource, "normalizeTask")}
        `,
        context
    );

    return context;
}

function extractFunction(source, functionName) {
    const pattern = new RegExp(
        `(?:function|const)\\s+${functionName}\\b`
    );

    const match = source.match(pattern);

    if (!match) {
        throw new Error(
            `No se encontró la función ${functionName} en app.js`
        );
    }

    const start = match.index;

    /*
     * Para funciones declaradas usamos balanceo de llaves.
     * Para const arrow también buscamos el bloque hasta el punto
     * y coma que cierra la declaración.
     */
    let braceStart = source.indexOf("{", start);

    if (braceStart === -1) {
        throw new Error(
            `No se encontró el cuerpo de ${functionName}`
        );
    }

    let depth = 0;
    let quote = null;
    let escaped = false;

    for (let i = braceStart; i < source.length; i++) {
        const char = source[i];

        if (quote) {
            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === "\\") {
                escaped = true;
                continue;
            }

            if (char === quote) {
                quote = null;
            }

            continue;
        }

        if (
            char === '"' ||
            char === "'" ||
            char === "`"
        ) {
            quote = char;
            continue;
        }

        if (char === "{") {
            depth++;
        } else if (char === "}") {
            depth--;

            if (depth === 0) {
                return source.slice(start, i + 1);
            }
        }
    }

    throw new Error(
        `No fue posible extraer ${functionName}`
    );
}

describe("Design Hub - utilidades", () => {
    let context;

    beforeEach(() => {
        context = createAppContext();
    });

    test("escapeHTML protege contenido HTML", () => {
        const malicious =
            `<script>alert("xss")</script>`;

        const result =
            context.escapeHTML(malicious);

        expect(result).not.toContain("<script>");
        expect(result).not.toContain("</script>");
        expect(result).toContain("&lt;");
        expect(result).toContain("&gt;");
    });

    test("escapeHTML conserva texto seguro", () => {
        expect(
            context.escapeHTML("Diseño editorial")
        ).toBe("Diseño editorial");
    });

    test("escapeHTML maneja null y undefined", () => {
        expect(context.escapeHTML(null)).toBe("");
        expect(context.escapeHTML(undefined)).toBe("");
    });

    test("normalizeText elimina espacios externos", () => {
        expect(
            context.normalizeText("  Camilo  ")
        ).toBe("Camilo");
    });

    test("normalizeText convierte valores en texto", () => {
        expect(
            context.normalizeText(123)
        ).toBe("123");
    });

    test("normalizeText maneja valores vacíos", () => {
        expect(context.normalizeText(null)).toBe("");
        expect(context.normalizeText(undefined)).toBe("");
    });

    test("normalizeUsername normaliza mayúsculas y espacios", () => {
        expect(
            context.normalizeUsername("  CaMiLo  ")
        ).toBe("camilo");
    });

    test("isValidDateString acepta YYYY-MM-DD válido", () => {
        expect(
            context.isValidDateString("2026-09-09")
        ).toBe(true);
    });

    test("isValidDateString rechaza formatos incorrectos", () => {
        expect(
            context.isValidDateString("09/09/2026")
        ).toBe(false);

        expect(
            context.isValidDateString("2026/09/09")
        ).toBe(false);

        expect(
            context.isValidDateString("")
        ).toBe(false);
    });

    test("toBoolean convierte valores booleanos correctamente", () => {
        expect(context.toBoolean(true)).toBe(true);
        expect(context.toBoolean(false)).toBe(false);
        expect(context.toBoolean("true")).toBe(true);
        expect(context.toBoolean("false")).toBe(false);
    });

    test("isSafeHttpUrl acepta http y https", () => {
        expect(
            context.isSafeHttpUrl(
                "https://example.com/avatar.jpg"
            )
        ).toBe(true);

        expect(
            context.isSafeHttpUrl(
                "http://example.com/avatar.jpg"
            )
        ).toBe(true);
    });

    test("isSafeHttpUrl rechaza javascript:", () => {
        expect(
            context.isSafeHttpUrl(
                "javascript:alert(1)"
            )
        ).toBe(false);
    });

    test("isSafeHttpUrl rechaza valores inválidos", () => {
        expect(
            context.isSafeHttpUrl("")
        ).toBe(false);

        expect(
            context.isSafeHttpUrl("imagen.jpg")
        ).toBe(false);
    });
});

describe("Design Hub - tareas", () => {
    let context;

    beforeEach(() => {
        context = createAppContext();
    });

    test("normalizeTask crea una tarea válida", () => {
        const task =
            context.normalizeTask({
                id: "100",
                name: "Nueva pieza",
                requester: "Comercial",
                assignee: "Camilo",
                status: "En curso",
                dateReceived: "2026-09-01",
                dateDelivered: "2026-09-10",
                isStarred: true
            });

        expect(task).toEqual({
            id: "100",
            name: "Nueva pieza",
            requester: "Comercial",
            assignee: "Camilo",
            status: "En curso",
            dateReceived: "2026-09-01",
            dateDelivered: "2026-09-10",
            isStarred: true
        });
    });

    test("normalizeTask elimina espacios de los campos de texto", () => {
        const task =
            context.normalizeTask({
                id: "200",
                name: "  Pieza  ",
                requester: "  Comercial ",
                assignee: " Camilo ",
                status: " En curso ",
                dateReceived: " 2026-09-01 ",
                dateDelivered: " 2026-09-10 ",
                isStarred: false
            });

        expect(task.name).toBe("Pieza");
        expect(task.requester).toBe("Comercial");
        expect(task.assignee).toBe("Camilo");
        expect(task.status).toBe("En curso");
        expect(task.dateReceived).toBe("2026-09-01");
        expect(task.dateDelivered).toBe("2026-09-10");
    });

    test("normalizeTask genera ID cuando no existe", () => {
        const task =
            context.normalizeTask({
                name: "Tarea"
            });

        expect(task.id).toBe("test-uuid-001");
    });

    test("normalizeTask establece estado por defecto", () => {
        const task =
            context.normalizeTask({
                id: "300",
                name: "Tarea"
            });

        expect(task.status).toBe("En curso");
        expect(task.isStarred).toBe(false);
    });

    test("normalizeTask rechaza valores que no son objetos", () => {
        expect(
            context.normalizeTask(null)
        ).toBeNull();

        expect(
            context.normalizeTask(undefined)
        ).toBeNull();

        expect(
            context.normalizeTask("tarea")
        ).toBeNull();
    });
});
