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
exports.iniciarMonitoramento = iniciarMonitoramento;
const chokidar_1 = __importDefault(require("chokidar"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const pastaDeVideos = path_1.default.resolve(__dirname, './../../../videos');
console.log('Caminho absoluto para a pasta de vídeos:', pastaDeVideos);
// Função que vai processar os vídeos detectados
function processarVideo(pathArquivo) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Extrair o nome do arquivo (sem caminho) a partir do path
            const nomeDoVideo = path_1.default.basename(pathArquivo);
            const caminhoDoVideo = pathArquivo;
            // Verificar se o vídeo já existe no banco de dados
            const videoExists = yield prisma.video.findMany({
                where: {
                    title: nomeDoVideo, // nome do arquivo extraído
                },
            });
            if (videoExists) {
                console.log(`Vídeo ${nomeDoVideo} já está no banco de dados.`);
            }
            else {
                // Adicionar o vídeo no banco de dados
                yield prisma.video.create({
                    data: {
                        title: nomeDoVideo,
                        url: caminhoDoVideo,
                        createdAt: new Date(),
                        category: '.',
                    },
                });
                console.log(`Vídeo ${nomeDoVideo} adicionado ao banco.`);
            }
        }
        catch (error) {
            console.error('Erro ao processar vídeo:', error);
        }
    });
}
// Função para iniciar o monitoramento
function iniciarMonitoramento() {
    console.log('iniciando monitoriamento da pasta');
    console.log('Caminho absoluto do diretório atual:', pastaDeVideos);
    const watcher = chokidar_1.default.watch(pastaDeVideos, {
        persistent: true,
        ignored: /^\./, // Ignorar arquivos ocultos
        ignoreInitial: true, // Ignorar arquivos na inicialização
    });
    // Monitorando os arquivos
    watcher.on('add', (pathArquivo) => {
        console.log(`Novo arquivo detectado: ${pathArquivo}`);
        processarVideo(pathArquivo);
    });
}
