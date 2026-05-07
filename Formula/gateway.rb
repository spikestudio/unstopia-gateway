class Gateway < Formula
  desc "Lightweight AI gateway daemon orchestrating Claude Code and Codex"
  homepage "https://github.com/spikestudio/unstopia-gateway"
  url "https://registry.npmjs.org/unstopia-gateway-cli/-/unstopia-gateway-cli-0.9.3.tgz"
  sha256 "2caec0e0e05f1e06142749e357dfad361baa2c85b3489be3552faa17503d22b2"
  license "MIT"

  livecheck do
    url "https://registry.npmjs.org/unstopia-gateway-cli"
    regex(/"latest":\s*"(\d+(?:\.\d+)+)"/)
  end

  depends_on "node@22"
  depends_on "python" => :build

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  def caveats
    <<~EOS
      To get started, run:
        gateway setup

      Then start the gateway daemon:
        gateway start

      The web dashboard will be available at http://localhost:7777
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/gateway --version")
    assert_match "Usage", shell_output("#{bin}/gateway --help")

    cd libexec/"lib/node_modules/unstopia-gateway-cli" do
      system "node", "-e", "require('better-sqlite3')"
      system "node", "-e", "require('classic-level')"
    end
  end
end
