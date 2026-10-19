/** The red "C" key tile used as the logo and as CORA's avatar in Ask. */
const CoraMark = ({ size = 32 }: { size?: number }) => (
  <span
    className='grid flex-none place-items-center rounded-[10px] bg-red-600 font-display font-extrabold text-white'
    style={{ width: size, height: size, fontSize: size * 0.53, boxShadow: '0 3px 0 #7f1d1d' }}
    aria-hidden='true'
  >
    C
  </span>
);

export default CoraMark;
