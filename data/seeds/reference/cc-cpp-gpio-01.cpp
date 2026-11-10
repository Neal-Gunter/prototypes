void gpio_init() {}
class Gpio { public: void set(int v) { (void)v; } };
int main() { gpio_init(); Gpio g; g.set(1); }
