import type { Request, Response } from 'express';

let app: any = null;

// Fonction pour charger l'application de manière asynchrone
async function loadApp() {
  if (app) return app;
  
  try {
    // Import dynamique de l'application
    const module = await import('../src/app');
    app = module.default;
    return app;
  } catch (error) {
    console.error('Erreur lors du chargement de l\'application:', error);
    throw error;
  }
}

// Handler Vercel asynchrone
export default async function handler(req: Request, res: Response) {
  try {
    const application = await loadApp();
    return application(req, res);
  } catch (error) {
    console.error('Erreur dans le handler Vercel:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
} 