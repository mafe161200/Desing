// Base de datos inicial de usuarios (Simulación de Backend)
// ADVERTENCIA DE SEGURIDAD: 
// Las contraseñas en texto plano solo se utilizan para propósitos de demostración.
// En un entorno de producción, la validación de usuarios debe realizarse
// mediante un Backend seguro (JWT) y las contraseñas guardadas con hashes (Bcrypt/Argon2).

const INITIAL_USERS = [
    { 
        username: "admin", 
        password: "Admin_DH2026!", 
        role: "admin", 
        name: "Administrador General",
        theme: "#4f46e5"
    },
    { 
        username: "camilo", 
        password: "Camilo_DH2026!", 
        role: "editor", 
        name: "Camilo",
        theme: "#db2777" 
    },
    { 
        username: "david", 
        password: "David_DH2026!", 
        role: "editor", 
        name: "David",
        theme: "#ea580c" 
    },
    { 
        username: "mafe", 
        password: "Mafe_DH2026!", 
        role: "editor", 
        name: "Mafe",
        theme: "#0284c7" 
    }
];