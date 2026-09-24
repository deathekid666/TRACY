import UniversalSearch from "@/components/UniversalSearch";

export default function Home(){
  return <main className="search-home">
    <div className="search-home-inner">
      <div className="brand-mark">TRACY</div>
      <h1 className="search-title">Find the public footprint.</h1>
      <p className="search-subtitle">Start with one identifier. TRACY searches public sources, filters unrelated results and builds the investigation automatically.</p>
      <UniversalSearch/>
      <div className="search-hints"><span>NAME</span><span>USERNAME</span><span>EMAIL</span><span>PHONE</span><span>DOMAIN</span></div>
      <p className="search-note">Public and lawfully accessible information only. Every finding remains tied to its source.</p>
    </div>
  </main>
}
