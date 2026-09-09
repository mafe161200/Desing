/**
 * Design Hub - configuración pública de perfiles
 *
 * IMPORTANTE:
 * Este archivo NO contiene contraseñas.
 *
 * La autenticación se realiza mediante Supabase Auth.
 * Estos datos son únicamente metadatos públicos del perfil
 * que la interfaz puede utilizar para identificar al usuario.
 */

const INITIAL_USERS = [
    {
        username: "admin",
        email: "admin@designhub.local",
        role: "admin",
        name: "Administrador General",
        avatar: "",
        theme: "#4f46e5"
    },
    {
        username: "camilo",
        email: "camilo@designhub.local",
        role: "editor",
        name: "Camilo",
        avatar: "",
        theme: "#db2777"
    },
    {
        username: "david",
        email: "david@designhub.local",
        role: "editor",
        name: "David",
        avatar: "",
        theme: "#ea580c"
    },
    {
        username: "mafe",
        email: "mafe@designhub.local",
        role: "editor",
        name: "Mafe",
        avatar: "",
        theme: "#0284c7"
    }
];

/**
 * Busca un perfil por nombre de usuario.
 */
function getInitialUserProfile(username) {
    const cleanUsername =
        String(username || "").trim().toLowerCase();

    return INITIAL_USERS.find(
        user =>
            user &&
            typeof user.username === "string" &&
            user.username.toLowerCase() === cleanUsername
    ) || null;
}
