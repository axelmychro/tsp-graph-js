import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header Menu Utama */}
      <header className="bg-white border-b border-slate-200 py-12 px-6 text-center shadow-sm">
        <div className="max-w-3xl mx-auto">
          <span className="px-3 py-1 bg-blue-50 text-blue-600 text-sm font-semibold rounded-full border border-blue-200">
            Proyek Matematika Diskrit - Kelompok 2
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight mt-4 text-slate-900 sm:text-5xl">
            Travelling Salesman Problem (TSP) Visualizer
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Analisis dan perbandingan performa graf menggunakan tiga pendekatan algoritma yang berbeda.
          </p>
        </div>
      </header>

      {/* Main Content (Tombol + Deskripsi + Cara Kerja) */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1: Brute Force */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500 text-2xl font-bold mb-4">
                🛑
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">1. Brute Force Algorithm</h2>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Mencari semua kemungkinan permutasi rute dari graf untuk menemukan jalur terpendek mutlak. Menjamin akurasi solusi 100%.
              </p>
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 mb-6">
                <span className="font-bold text-slate-800 block mb-1">Cara Kerja:</span>
                1. Sistem generate semua kemungkinan rute.<br/>
                2. Menghitung total bobot/jarak setiap rute.<br/>
                3. Memilih rute dengan total bobot paling minimum.
              </div>
            </div>
            <Link 
              href="/algoritma/brute-force" 
              className="w-full text-center py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm transition-colors"
            >
              Buka Algoritma &rarr;
            </Link>
          </div>

          {/* Card 2: Branch and Bound */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 text-2xl font-bold mb-4">
                🌿
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">2. Branch & Bound</h2>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Mempercepat pencarian dengan memotong cabang pohon keputusan (state space tree) yang nilai batasnya (bound) sudah tidak efisien.
              </p>
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 mb-6">
                <span className="font-bold text-slate-800 block mb-1">Cara Kerja:</span>
                1. Graf dipecah menjadi beberapa cabang keputusan.<br/>
                2. Setiap cabang dihitung nilai batas bawahnya (bound).<br/>
                3. Jika nilai bound cabang &gt; rute terbaik sementara, cabang diabaikan.
              </div>
            </div>
            <Link 
              href="/algoritma/branch-and-bound" 
              className="w-full text-center py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm transition-colors"
            >
              Buka Algoritma &rarr;
            </Link>
          </div>

          {/* Card 3: Heuristik (Nearest Neighbor) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 text-2xl font-bold mb-4">
                ✨
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">3. Heuristic Algorithm</h2>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Pendekatan cepat dengan mengambil keputusan lokal terbaik di setiap tahap. Sangat efisien namun hasilnya belum tentu optimal mutlak.
              </p>
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 mb-6">
                <span className="font-bold text-slate-800 block mb-1">Cara Kerja:</span>
                1. Mulai dari simpul (kota) awal acak.<br/>
                2. Cari simpul terdekat yang belum pernah dikunjungi.<br/>
                3. Bergerak ke simpul tersebut dan ulangi sampai semua kota terkunjungi.
              </div>
            </div>
            <Link 
              href="/algoritma/heuristik" 
              className="w-full text-center py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm transition-colors"
            >
              Buka Algoritma &rarr;
            </Link>
          </div>

        </div>

        {/* Section Aturan Graf */}
        <section className="mt-16 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Penerapan Utama Teori Graf pada TSP</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Dalam proyek ini, masalah pedagang keliling dimodelkan ke dalam sistem graf berbobot. Kota direpresentasikan sebagai <strong>Simpul (Vertex)</strong>, sedangkan jalan penghubung antar kota beserta jarak/biayanya direpresentasikan sebagai <strong>Sisi Berbobot (Weighted Edge)</strong>. Tujuan utama dari ketiga algoritma di atas adalah mencari sirkuit Hamilton berbobot minimum.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-slate-400 border-t border-slate-200 bg-white mt-12">
        &copy; 2026 Kelompok 2 - Matematika Diskrit. All rights reserved.
      </footer>
    </div>
  );
}