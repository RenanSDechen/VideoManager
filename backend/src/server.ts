import express, { Request, Response, NextFunction } from "express";
import { PrismaClient, User } from "@prisma/client";
import jwt from 'jsonwebtoken';
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import multer from "multer"; // Importa o Multer para upload de arquivos
import cors from "cors";
import fs from "fs"; // Para garantir que a pasta de uploads existe
import { error } from "console";
import path from "path";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Certifique-se de que a pasta de uploads existe
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}// Segredo usado para assinar o token (use variáveis de ambiente para segurança)
const JWT_SECRET = process.env.JWT_SECRET || "2638d15fda36da71b50880681d05a65043a27e52076bba7865647b31fd88e385";

// Função para gerar o token
function generateToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "1h", // Expira em 1 hora
  });
}

app.use(express.json());
// Configurar o CORS
app.use(cors({
  origin: 'http://localhost:3000',  // Permite requisições apenas de http://localhost:3000
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'], // Permite os métodos HTTP específicos
  allowedHeaders: ['Content-Type', 'Authorization'], // Permite os cabeçalhos específicos
}));
// Servir arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
console.log('Caminho da pasta uploads:', path.join(__dirname, 'uploads'));
// Configuração do Multer para armazenar arquivos localmente
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: (arg0: null, arg1: string) => void) => {
    cb(null, uploadDir); // Diretório onde os arquivos serão armazenados
  },
  filename: (req: any, file: { originalname: string; }, cb: (arg0: null, arg1: string) => void) => {
    cb(null, Date.now() + '-' + file.originalname); // Nome único para cada arquivo
  },
});
const upload = multer({ storage: storage });


const authenticateJWT = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
      if (err) {
        return res.status(403).send("Token inválido.");
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).send("Token não fornecido.");
  }
};

const checkRole = (roles: string[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    console.log("req.user:", req.user); // Loga a estrutura de req.user
    const userRole = req.user?.role;
    console.log("Papel do usuário:", userRole); // Loga o papel extraído

    if (!roles.includes(userRole)) {
      return res.status(403).send("Acesso negado usuário insuficiente.");
    }
    next();
  };
};


//rotas videos----------------------------------------------------------------------------------
app.get("/api/videos", async (req: Request, res: Response) => {
  try {
    const videos = await prisma.video.findMany({
      select: {
        id: true,
        title: true,
        url: true,
        thumbnail: true,
        description: true,
        tags: true,  // tags está como string no banco
        category: true,
        date: true,
      },
    });

    // ✅ Garantindo que `tags` seja um array
    const formattedVideos = videos.map(video => ({
      ...video,
      tags: video.tags ? video.tags.split(",") : [], // Transforma "tag1,tag2" em ["tag1", "tag2"]
    }));

    res.json(formattedVideos);
  } catch (error) {
    console.error("Erro ao buscar vídeos:", error);
    res.status(500).json({ error: "Erro interno ao buscar vídeos." });
  }
});

app.post(
  "/api/videos",
  authenticateJWT,
  checkRole(["admin", "superadmin"]),
  upload.fields([{ name: "file" }, { name: "thumbnail" }]), // ✅ Permite enviar um vídeo e uma thumbnail
  async (req: Request, res: Response) => {
    const { title, description, tags, date } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).send("Unauthorized");
    }

    // Verifica se os dados obrigatórios foram fornecidos
    if (!title || !description || !tags) {
      return res.status(400).send("Title, description, and tags are required.");
    }

    // 🔥 Correção: Garantimos que `req.files` é um objeto indexado corretamente
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Pegamos o caminho do vídeo e da thumbnail corretamente
    const videoPath = files?.["file"]?.[0]?.path || "";
    const thumbnailPath = files?.["thumbnail"]?.[0]?.path || ""; 

    try {
      const video = await prisma.video.create({
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
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      res.status(500).send("Error uploading video");
    }
  }
);



app.delete("/api/videos/:id", authenticateJWT,  checkRole(["admin", "superadmin"]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const video = await prisma.video.delete({
    where: { id: parseInt(id) },
  });
  res.json(video);
});

//rotas privadas tags----------------------------------------------------------------------------------


app.get("/api/tags",  async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      select: {
        id: true,
        title: true,
        description: true,
      },
    });
    res.json(tags);
  } catch (error) {
    console.error("Erro ao listar tags:", error);
    res.status(500).json({ error: "Erro ao listar tags." });
  }
});

app.post("/api/tag/:id", authenticateJWT, checkRole([ "superadmin"]), async (req: Request, res: Response) => {
  const { title, description } = req.body;
  const userId = req.user?.id;
  const role = req.user?.role;
  const id  = parseInt(req.params.id);
  console.log(role);
  if (!userId) {
    return res.status(401).send("Unauthorized");
  }
  console.log([title,description]);

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
    const video = await prisma.tag.update({
      where: { id: id },
      data: tagData
    });
    res.json(video);
  } catch (error) {
    console.error("Erro ao fazer upload:", error);
    res.status(500).send("Error uploading video");
  }
});

app.delete("/api/tag/:id", authenticateJWT,  checkRole([ "superadmin"]), async (req: Request, res: Response) => {
  const { id } = req.params;

  const tags = await prisma.tag.delete({
    where: { id: parseInt(id) },
  });
  res.json(tags);
});

app.post("/api/tag", authenticateJWT, checkRole(["admin", "superadmin"]), async (req, res) => {
  console.log("api/tag acionada");
  const userId: number | undefined = req.user?.id;

  // 🔹 1. Se userId for undefined, retorna erro antes de prosseguir
  if (typeof userId !== "number") {
    return res.status(401).json({ error: "Usuário não autenticado ou ID inválido." });
  }
  try {
    const { title, description } = req.body;

    // Verificar se todos os campos foram fornecidos
    if (!title || !description) {
      console.log(title,description);
      return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    // Verificar se o nome de tag já está em uso
    const existingUser = await prisma.tag.findFirst({
      where: { title: title },
    });

    if (existingUser) {
      return res.status(409).json({ error: "O titulo da tag já está em uso." });
    }

    const tag = await prisma.tag.create({
      data: {
        title ,
        description,
        userId
      },
    });

    // Retornar sucesso
    res.status(201).json({
      message: "tag registrado com sucesso.",
      user: { id: tag.id, description: tag.description }, // Enviar apenas informações públicas
    });
  } catch (error) {
    console.error("Erro ao registrar tag:", error);
    res.status(500).json({ error: "Erro interno do servidor. Por favor, tente novamente mais tarde." });
  }
});


//rotas login e register----------------------------------------------------------------------------------

app.post("/api/register", authenticateJWT, checkRole(["admin", "superadmin"]), async (req, res) => {
  console.log("api/register acionada");
  
  try {
    const { username, password } = req.body;

    // Verificar se todos os campos foram fornecidos
    if (!username || !password) {
      console.log(username,password);
      return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    // Verificar se o nome de usuário já está em uso
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(409).json({ error: "O nome de usuário já está em uso." });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar o usuário no banco de dados
    const user = await prisma.user.create({
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
  } catch (error) {
    console.error("Erro ao registrar usuário:", error);
    res.status(500).json({ error: "Erro interno do servidor. Por favor, tente novamente mais tarde." });
  }
});

// User login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).send("Invalid credentials");
  }

  const token = generateToken({ id: user.id, role: user.role });
  res.json({ token });
});


//rotas user----------------------------------------------------------------------------------





app.put("/api/user/:id", authenticateJWT, checkRole(["superadmin"]), async (req: Request, res: Response) => {
  try {
    const { username, email, role } = req.body;
    const id = parseInt(req.params.id);

    if (!username || !email) {
      return res.status(400).json({ error: "Username e email são obrigatórios." });
    }

    const userExists = await prisma.user.findUnique({ where: { id } });

    if (!userExists) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { username, email, role }
    });

    res.json({ message: "Usuário atualizado com sucesso!", user: updatedUser });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    res.status(500).json({ error: "Erro interno ao atualizar usuário." });
  }
});

app.delete(  "/api/user/:id",  authenticateJWT, checkRole([ "superadmin"]),  async (req: Request, res: Response) => {
    try {
      const  id  = parseInt(req.params.id);

      if (isNaN(id)) {
        return res
          .status(400)
          .json({error: "O parâmetro 'id' deve ser um número válido." });
      }

      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({error: "Usuário não encontrado"});
      }

      if(user.role === "superadmin"){
        return res
          .status(403)
          .json({error:"Não é permitido deletar um super usuário"})
      }

      const deleteUser = await prisma.user.delete({
        where: { id },
      });

      return res.json({
        message: "Usuário deletado com sucesso.",
        user:deleteUser,
      });
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      return res
        .status(500)
        .json({ error: "Ocorreu um erro interno ao deletar o usuário." });
    }


   
    


});
app.get("/api/user", authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.user?.id; // O ID do usuário autenticado extraído do token JWT
  console.log("rota acionada user :" + userId);
  try {
    const user = await prisma.user.findUnique({
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
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});
//admin endpoints
app.get("/api/users", authenticateJWT, checkRole(["superadmin"]), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email:true,
        role: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ error: "Erro ao listar usuários." });
  }
});




// Start server
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
