/* v16：在电脑上用 gcc 编译固件的 OCTL/1 解析核心（octopus_link_core.h），给 scripts/link-test.mjs 逐行对照。
 * 输入：每行一帧（不含换行）；输出：OK seq cmd n a0 a1 … 或 ERR code；以 "#SEAL seq CMD args" 开头的行 → 输出 octl_seal 结果 */
#include <stdio.h>
#include <string.h>
#include "../src/assembly/octopus/plus/octopus_plus/octopus_link_core.h"
int main(void) {
    static char line[4096];
    while (fgets(line, sizeof(line), stdin)) {
        size_t n = strlen(line);
        if (n && line[n - 1] == '\n') line[--n] = 0;
        if (!strncmp(line, "#SEAL ", 6)) {
            unsigned seq = 0; char cmd[16] = {0}; int off = 0;
            if (sscanf(line + 6, "%u %15s %n", &seq, cmd, &off) < 2) { puts("ERR seal"); continue; }
            const char* args = off ? line + 6 + off : "";
            char out[256];
            size_t k = octl_seal(out, sizeof(out), seq, cmd, args);
            if (!k) puts("SEAL 0"); else { out[k - 1] = 0; printf("SEAL %s\n", out); }
            continue;
        }
        octl_frame f;
        int e = octl_parse(line, n, &f);
        if (e) { printf("ERR %d\n", e); continue; }
        printf("OK %u %s %d", f.seq, f.cmd, f.nargs);
        for (int i = 0; i < f.nargs; i++) { if (isnan(f.args[i])) printf(" nan"); else printf(" %.17g", f.args[i]); }
        putchar('\n');
    }
    return 0;
}
