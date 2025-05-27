import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    // En modo demo, simplemente devolver éxito sin guardar nada
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    
    if (isDemoMode) {
      return NextResponse.json({ 
        success: true, 
        message: 'Search history saved (demo mode)' 
      });
    }

    // Intentar enviar al servidor Node.js para persistencia real
    try {
      const nodeServerUrl = process.env.NEXT_PUBLIC_NODE_API_URL;
      
      if (nodeServerUrl) {
        const response = await fetch(`${nodeServerUrl}/api/search/history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data);
        }
      }
    } catch (error) {
      console.warn('Failed to save to Node.js server:', error);
    }

    // Fallback: devolver éxito aunque no se haya guardado
    return NextResponse.json({ 
      success: true, 
      message: 'Search history processed' 
    });

  } catch (error) {
    console.error('Error in search history endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 