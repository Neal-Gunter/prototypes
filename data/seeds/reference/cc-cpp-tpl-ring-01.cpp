template<typename T> class Slot {};
template<typename T, typename Buf = Slot<Slot<T>>> class RingBuffer {
public:
  void push(const T&) {}
};
