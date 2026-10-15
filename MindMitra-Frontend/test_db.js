const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/chinthangupadhya/MindMitra-Frontend/.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(10);
  
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

test();
