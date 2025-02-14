"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const multer_1 = __importDefault(require("multer")); // Importa o Multer para upload de arquivos
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs")); // Para garantir que a pasta de uploads existe
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
// Certifique-se de que a pasta de uploads existe
const uploadDir = 'uploads/';
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir);
} // Segredo usado para assinar o token (use variáveis de ambiente para segurança)
const JWT_SECRET = process.env.JWT_SECRET || "2638d15fda36da71b50880681d05a65043a27e52076bba7865647b31fd88e385";
// Função para gerar o token
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: "1h", // Expira em 1 hora
    });
}
app.use(express_1.default.json());
// Configurar o CORS
app.use((0, cors_1.default)({
    origin: 'http://localhost:3000', // Permite requisições apenas de http://localhost:3000
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'], // Permite os métodos HTTP específicos
    allowedHeaders: ['Content-Type', 'Authorization'], // Permite os cabeçalhos específicos
}));
// Servir arquivos estáticos
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
console.log('Caminho da pasta uploads:', path_1.default.join(__dirname, 'uploads'));
// Configuração do Multer para armazenar arquivos localmente
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Diretório onde os arquivos serão armazenados
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Nome único para cada arquivo
    },
});
const upload = (0, multer_1.default)({ storage: storage });
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).send("Token inválido.");
            }
            req.user = user;
            next();
        });
    }
    else {
        res.status(401).send("Token não fornecido.");
    }
};
const checkRole = (roles) => {
    return (req, res, next) => {
        var _a;
        console.log("req.user:", req.user); // Loga a estrutura de req.user
        const userRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
        console.log("Papel do usuário:", userRole); // Loga o papel extraído
        if (!roles.includes(userRole)) {
            return res.status(403).send("Acesso negado usuário insuficiente.");
        }
        next();
    };
};
//rotas videos----------------------------------------------------------------------------------
app.get("/api/videos", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const videos = yield prisma.video.findMany({
            select: {
                id: true,
                title: true,
                url: true,
                thumbnail: true,
                description: true,
                tags: true, // tags está como string no banco
                category: true,
                date: true,
            },
        });
        // ✅ Garantindo que `tags` seja um array
        const formattedVideos = videos.map(video => (Object.assign(Object.assign({}, video), { tags: video.tags ? video.tags.split(",") : [] })));
        res.json(formattedVideos);
    }
    catch (error) {
        console.error("Erro ao buscar vídeos:", error);
        res.status(500).json({ error: "Erro interno ao buscar vídeos." });
    }
}));
app.post("/api/videos", authenticateJWT, checkRole(["admin", "superadmin"]), upload.fields([{ name: "file" }, { name: "thumbnail" }]), // ✅ Permite enviar um vídeo e uma thumbnail
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const { title, description, tags, date } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        return res.status(401).send("Unauthorized");
    }
    // Verifica se os dados obrigatórios foram fornecidos
    if (!title || !description || !tags) {
        return res.status(400).send("Title, description, and tags are required.");
    }
    // 🔥 Correção: Garantimos que `req.files` é um objeto indexado corretamente
    const files = req.files;
    // Pegamos o caminho do vídeo e da thumbnail corretamente
    const videoPath = ((_c = (_b = files === null || files === void 0 ? void 0 : files["file"]) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.path) || "";
    const thumbnailPath = ((_e = (_d = files === null || files === void 0 ? void 0 : files["thumbnail"]) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.path) || "";
    try {
        const video = yield prisma.video.create({
            data: {
                title,
                description,
                tags,
                url: videoPath,
                thumbnail: thumbnailPath, // ✅ Salvando a thumbnail corretamente
                userId,
                date,
            },
        });
        res.json(video);
    }
    catch (error) {
        console.error("Erro ao fazer upload:", error);
        res.status(500).send("Error uploading video");
    }
}));
app.delete("/api/videos/:id", authenticateJWT, checkRole(["admin", "superadmin"]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const video = yield prisma.video.delete({
        where: { id: parseInt(id) },
    });
    res.json(video);
}));
//rotas privadas tags----------------------------------------------------------------------------------
app.get("/api/tags", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tags = yield prisma.tag.findMany({
            select: {
                id: true,
                title: true,
                description: true,
            },
        });
        res.json(tags);
    }
    catch (error) {
        console.error("Erro ao listar tags:", error);
        res.status(500).json({ error: "Erro ao listar tags." });
    }
}));
app.post("/api/tag/:id", authenticateJWT, checkRole(["superadmin"]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { title, description } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const role = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
    const id = parseInt(req.params.id);
    console.log(role);
    if (!userId) {
        return res.status(401).send("Unauthorized");
    }
    console.log([title, description]);
    // Verifica se o título foi fornecido
    if (!title || !description) {
        return res.status(400).send("Title, description are required.");
    }
    const tagData = {
        title,
        description,
        userId,
    };
    try {
        const video = yield prisma.tag.update({
            where: { id: id },
            data: tagData
        });
        res.json(video);
    }
    catch (error) {
        console.error("Erro ao fazer upload:", error);
        res.status(500).send("Error uploading video");
    }
}));
app.delete("/api/tag/:id", authenticateJWT, checkRole(["superadmin"]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const tags = yield prisma.tag.delete({
        where: { id: parseInt(id) },
    });
    res.json(tags);
}));
app.post("/api/tag", authenticateJWT, checkRole(["admin", "superadmin"]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("api/tag acionada");
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    // 🔹 1. Se userId for undefined, retorna erro antes de prosseguir
    if (typeof userId !== "number") {
        return res.status(401).json({ error: "Usuário não autenticado ou ID inválido." });
    }
    try {
        const { title, description } = req.body;
        // Verificar se todos os campos foram fornecidos
        if (!title || !description) {
            console.log(title, description);
            return res.status(400).json({ error: "Todos os campos são obrigatórios." });
        }
        // Verificar se o nome de tag já está em uso
        const existingUser = yield prisma.tag.findFirst({
            where: { title: title },
        });
        if (existingUser) {
            return res.status(409).json({ error: "O titulo da tag já está em uso." });
        }
        const tag = yield prisma.tag.create({
            data: {
                title,
                description,
                userId
            },
        });
        // Retornar sucesso
        res.status(201).json({
            message: "tag registrado com sucesso.",
            user: { id: tag.id, description: tag.description }, // Enviar apenas informações públicas
        });
    }
    catch (error) {
        console.error("Erro ao registrar tag:", error);
        res.status(500).json({ error: "Erro interno do servidor. Por favor, tente novamente mais tarde." });
    }
}));
//rotas login e register----------------------------------------------------------------------------------
app.post("/api/register", authenticateJWT, checkRole(["admin", "superadmin"]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("api/register acionada");
    try {
        const { username, password } = req.body;
        // Verificar se todos os campos foram fornecidos
        if (!username || !password) {
            console.log(username, password);
            return res.status(400).json({ error: "Todos os campos são obrigatórios." });
        }
        // Verificar se o nome de usuário já está em uso
        const existingUser = yield prisma.user.findUnique({
            where: { username },
        });
        if (existingUser) {
            return res.status(409).json({ error: "O nome de usuário já está em uso." });
        }
        // Hash da senha
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        // Criar o usuário no banco de dados
        const user = yield prisma.user.create({
            data: {
                username,
                password: hashedPassword,
            },
        });
        // Retornar sucesso
        res.status(201).json({
            message: "Usuário registrado com sucesso.",
            user: { id: user.id, username: user.username }, // Enviar apenas informações públicas
        });
    }
    catch (error) {
        console.error("Erro ao registrar usuário:", error);
        res.status(500).json({ error: "Erro interno do servidor. Por favor, tente novamente mais tarde." });
    }
}));
// User login
app.post("/api/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    const user = yield prisma.user.findUnique({
        where: { username },
    });
    if (!user || !bcryptjs_1.default.compareSync(password, user.password)) {
        return res.status(400).send("Invalid credentials");
    }
    const token = generateToken({ id: user.id, role: user.role });
    res.json({ token });
}));
//rotas user----------------------------------------------------------------------------------
app.put("/api/user/:id", authenticateJWT, checkRole(["superadmin"]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, email, role } = req.body;
        const id = parseInt(req.params.id);
        if (!username || !email) {
            return res.status(400).json({ error: "Username e email são obrigatórios." });
        }
        const userExists = yield prisma.user.findUnique({ where: { id } });
        if (!userExists) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        const updatedUser = yield prisma.user.update({
            where: { id },
            data: { username, email, role }
        });
        res.json({ message: "Usuário atualizado com sucesso!", user: updatedUser });
    }
    catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        res.status(500).json({ error: "Erro interno ao atualizar usuário." });
    }
}));
app.delete("/api/user/:id", authenticateJWT, checkRole(["superadmin"]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res
                .status(400)
                .json({ error: "O parâmetro 'id' deve ser um número válido." });
        }
        const user = yield prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (user.role === "superadmin") {
            return res
                .status(403)
                .json({ error: "Não é permitido deletar um super usuário" });
        }
        const deleteUser = yield prisma.user.delete({
            where: { id },
        });
        return res.json({
            message: "Usuário deletado com sucesso.",
            user: deleteUser,
        });
    }
    catch (error) {
        console.error("Erro ao deletar usuário:", error);
        return res
            .status(500)
            .json({ error: "Ocorreu um erro interno ao deletar o usuário." });
    }
}));
app.get("/api/user", authenticateJWT, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id; // O ID do usuário autenticado extraído do token JWT
    console.log("rota acionada user :" + userId);
    try {
        const user = yield prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                role: true
            },
        });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        res.json(user);
    }
    catch (error) {
        console.error("Erro ao buscar usuário:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
}));
//admin endpoints
app.get("/api/users", authenticateJWT, checkRole(["superadmin"]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
            },
        });
        res.json(users);
    }
    catch (error) {
        console.error("Erro ao listar usuários:", error);
        res.status(500).json({ error: "Erro ao listar usuários." });
    }
}));
// Start server
app.listen(5000, () => {
    console.log("Server running on http://localhost:5000");
});
