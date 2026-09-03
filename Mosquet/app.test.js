// Test Suites para validación de Lógica (Requiere Jest: npm i -D jest)

describe('DataService Tests (Mocked Storage)', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    test('getTasks debería inicializar como arreglo vacío', async () => {
        const tasks = await DataService.getTasks();
        expect(Array.isArray(tasks)).toBe(true);
        expect(tasks.length).toBe(0);
    });

    test('saveTasks debería guardar tareas en LocalStorage simulación', async () => {
        const mockTasks = [{ id: "100", name: "Tarea Responsiva" }];
        await DataService.saveTasks(mockTasks);
        
        const retrieved = await DataService.getTasks();
        expect(retrieved.length).toBe(1);
        expect(retrieved[0].name).toBe("Tarea Responsiva");
    });
});

describe('Security / Sanitization Tests', () => {
    test('escapeHTML previene inyección de scripts básicos', () => {
        const maliciousString = "<script>alert('xss')</script>";
        const safeString = escapeHTML(maliciousString);
        expect(safeString).not.toContain("<script>");
        expect(safeString).toBe("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
    });
    
    test('escapeHTML maneja strings vacíos o nulls de forma segura', () => {
        expect(escapeHTML(null)).toBe('');
        expect(escapeHTML(undefined)).toBe('');
        expect(escapeHTML('')).toBe('');
    });
});
