import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase config');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
    console.log('Verificando coluna final_numero_quadro na tabela motos...');
    const { data, error } = await supabase
        .from('motos')
        .select('final_numero_quadro')
        .limit(1);

    if (error) {
        console.error('Erro ao verificar motos:', error.message);
    } else {
        console.log('Coluna final_numero_quadro existe na tabela motos.');
    }

    console.log('Verificando coluna final_numero_quadro na tabela entradas...');
    const { data: data2, error: error2 } = await supabase
        .from('entradas')
        .select('final_numero_quadro')
        .limit(1);

    if (error2) {
        console.error('Erro ao verificar entradas:', error2.message);
    } else {
        console.log('Coluna final_numero_quadro existe na tabela entradas.');
    }
}

verify();
