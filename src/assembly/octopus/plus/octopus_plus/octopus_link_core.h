/*
 * v16 我的补充：OCTL/1 行协议的帧格式核心（C 也能编译，方便在电脑上用 gcc 和浏览器端 src/link/protocol.js 逐字节对照测试）。
 *
 *   帧   := '@' 序号 ' ' 指令 { ' ' 参数 } '*' CRC '\n'
 *   序号 := 0..65535（十进制，1–5 位）；主机每帧加 1；设备主动发的帧（TEL / BOOT / EVT）序号为 0
 *   指令 := 1–7 个大写字母
 *   参数 := 十进制数（可带 '-' 和小数点，最多 15 个字符）或 '-'（没有数据，解析成 NaN），最多 24 个
 *   CRC  := CRC-16/CCITT-FALSE（多项式 0x1021，初值 0xFFFF），算 '@' 到 '*' 之前（不含 '*'）的全部字节，4 位十六进制
 *   一行最长 160 字节（不含换行）；超长、格式错、CRC 错的行整行丢掉并回 NAK
 * 早期原型：只在电脑上测过解析，没在实物上测过收发。
 */
#ifndef OCTOPUS_LINK_CORE_H
#define OCTOPUS_LINK_CORE_H
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define OCTL_VERSION 1
#define OCTL_MAX_LINE 160
#define OCTL_MAX_ARGS 24
#define OCTL_MAX_NUM 15

enum { OCTL_OK = 0, OCTL_E_FORMAT = 1, OCTL_E_CRC = 2, OCTL_E_LEN = 3, OCTL_E_ARGS = 4 };

typedef struct {
    unsigned seq;
    char cmd[8];
    int nargs;
    double args[OCTL_MAX_ARGS];
} octl_frame;

static inline uint16_t octl_crc16(const char* s, size_t n) {
    uint16_t c = 0xFFFF;
    for (size_t i = 0; i < n; i++) {
        c = (uint16_t)(c ^ (uint16_t)((uint8_t)s[i] << 8));
        for (int b = 0; b < 8; b++) c = (c & 0x8000) ? (uint16_t)((c << 1) ^ 0x1021) : (uint16_t)(c << 1);
    }
    return c;
}

static inline int octl_hex(char ch) {
    if (ch >= '0' && ch <= '9') return ch - '0';
    if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
    if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
    return -1;
}

/* 数字记号：-?D+(.D+)? */
static inline int octl_is_num(const char* t, size_t n) {
    size_t i = 0, d = 0;
    if (n == 0 || n > OCTL_MAX_NUM) return 0;
    if (t[0] == '-') i = 1;
    while (i < n && t[i] >= '0' && t[i] <= '9') { i++; d++; }
    if (d == 0) return 0;
    if (i == n) return 1;
    if (t[i] != '.') return 0;
    i++; d = 0;
    while (i < n && t[i] >= '0' && t[i] <= '9') { i++; d++; }
    return d > 0 && i == n;
}

/* line：不含 '\n'（末尾的 '\r' 会被忽略）；len = 字节数 */
static inline int octl_parse(const char* line, size_t len, octl_frame* f) {
    if (len > 0 && line[len - 1] == '\r') len--;
    if (len > OCTL_MAX_LINE) return OCTL_E_LEN;
    if (len < 8 || line[0] != '@') return OCTL_E_FORMAT;
    size_t star = len - 5;
    if (line[star] != '*') return OCTL_E_FORMAT;
    unsigned want = 0;
    for (size_t i = star + 1; i < len; i++) { int h = octl_hex(line[i]); if (h < 0) return OCTL_E_FORMAT; want = (want << 4) | (unsigned)h; }
    for (size_t i = 1; i < star; i++) { unsigned char ch = (unsigned char)line[i]; if (ch < 0x20 || ch > 0x7E || ch == '*' || ch == '@') return OCTL_E_FORMAT; }
    if (octl_crc16(line, star) != want) return OCTL_E_CRC;
    size_t i = 1; int tok = 0; f->nargs = 0; f->seq = 0; f->cmd[0] = 0;
    while (i < star) {
        size_t j = i;
        while (j < star && line[j] != ' ') j++;
        size_t n = j - i;
        if (n == 0) return OCTL_E_FORMAT;
        const char* t = line + i;
        if (tok == 0) {
            if (n > 5) return OCTL_E_FORMAT;
            unsigned v = 0;
            for (size_t k = 0; k < n; k++) { if (t[k] < '0' || t[k] > '9') return OCTL_E_FORMAT; v = v * 10 + (unsigned)(t[k] - '0'); }
            if (v > 65535) return OCTL_E_FORMAT;
            f->seq = v;
        } else if (tok == 1) {
            if (n > 7) return OCTL_E_FORMAT;
            for (size_t k = 0; k < n; k++) { if (t[k] < 'A' || t[k] > 'Z') return OCTL_E_FORMAT; f->cmd[k] = t[k]; }
            f->cmd[n] = 0;
        } else {
            if (f->nargs >= OCTL_MAX_ARGS) return OCTL_E_ARGS;
            if (n == 1 && t[0] == '-') f->args[f->nargs++] = NAN;
            else {
                if (!octl_is_num(t, n)) return OCTL_E_FORMAT;
                char buf[OCTL_MAX_NUM + 1];
                memcpy(buf, t, n); buf[n] = 0;
                f->args[f->nargs++] = strtod(buf, NULL);
            }
        }
        tok++;
        if (j == star) break;
        i = j + 1;
        if (i == star) return OCTL_E_FORMAT;   /* 结尾多一个空格 */
    }
    return tok >= 2 ? OCTL_OK : OCTL_E_FORMAT;
}

/* 把 "@序号 指令 参数…" 补上 "*CRC\n"；body 不含 '@'。返回写入字节数（不含 '\0'），放不下返回 0 */
static inline size_t octl_seal(char* out, size_t cap, unsigned seq, const char* cmd, const char* args) {
    size_t n = 0, la = args ? strlen(args) : 0, lc = strlen(cmd);
    char sq[8]; int ls = 0; unsigned v = seq; char rev[8];
    do { rev[ls++] = (char)('0' + v % 10); v /= 10; } while (v && ls < 6);
    for (int k = 0; k < ls; k++) sq[k] = rev[ls - 1 - k];
    size_t need = 1 + (size_t)ls + 1 + lc + (la ? 1 + la : 0) + 5 + 1;
    if (need + 1 > cap || need - 1 > OCTL_MAX_LINE) return 0;
    out[n++] = '@';
    memcpy(out + n, sq, (size_t)ls); n += (size_t)ls;
    out[n++] = ' ';
    memcpy(out + n, cmd, lc); n += lc;
    if (la) { out[n++] = ' '; memcpy(out + n, args, la); n += la; }
    uint16_t c = octl_crc16(out, n);
    static const char* H = "0123456789ABCDEF";
    out[n++] = '*';
    out[n++] = H[(c >> 12) & 15]; out[n++] = H[(c >> 8) & 15]; out[n++] = H[(c >> 4) & 15]; out[n++] = H[c & 15];
    out[n++] = '\n';
    out[n] = 0;
    return n;
}

#endif
