import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) {
          toast.error(error.message || 'Erro ao criar conta');
        } else {
          toast.success('Conta criada com sucesso! Verifique seu email.');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message || 'Erro ao fazer login');
        } else {
          toast.success('Login realizado com sucesso!');
        }
      }
    } catch (err) {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <Card className="card-samurai w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl text-foreground mb-2">
            Samurai Gestão
          </h1>
          <p className="font-sans text-sm text-foreground/60">
            {isSignUp ? 'Crie sua conta' : 'Faça login para continuar'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-widest">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-card border-foreground/10"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs uppercase tracking-widest">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-card border-foreground/10"
              disabled={loading}
              required
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full btn-samurai"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isSignUp ? 'Criando conta...' : 'Entrando...'}
              </>
            ) : (
              isSignUp ? 'Criar Conta' : 'Entrar'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-sans text-sm text-foreground/60 hover:text-foreground transition-colors"
            disabled={loading}
          >
            {isSignUp ? (
              <>
                Já tem uma conta? <span className="text-accent font-semibold">Faça login</span>
              </>
            ) : (
              <>
                Não tem uma conta? <span className="text-accent font-semibold">Cadastre-se</span>
              </>
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}

