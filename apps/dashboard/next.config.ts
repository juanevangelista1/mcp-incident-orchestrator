import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lucide-react e recharts exportam muitos módulos nomeados de um único entry point — sem
  // isso, importar um ícone/gráfico pode arrastar a lib inteira pro bundle do cliente em vez
  // de só o que é usado. exceljs/jspdf ficam de fora de propósito: já são carregados via
  // import() dinâmico dentro do clique de exportar, não no carregamento da página.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
