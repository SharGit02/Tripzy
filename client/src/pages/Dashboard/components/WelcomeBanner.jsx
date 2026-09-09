import { motion } from "framer-motion";
// import heroImg from "../../../assets/images/hero.png";
import heroImgMountains from "../../../assets/images/heroMountains.png";

export default function WelcomeBanner({ userName }) {
  const firstName = userName ? userName.split(" ")[0] : "Explorer";

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="border-3 border-blue-400  border-dashed relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#eaf4fb] to-[#ddeef8] border border-[#c8e4f4] shadow-sm"
      style={{ minHeight: "140px" }}
    >
      {/* Text */}
      <div className="relative z-10 p-6 pr-48">
        <h1 className="text-2xl font-extrabold text-[#0f2442] leading-tight">
          Welcome back,{" "}
          <span className="text-[#2563EB]">{firstName}!</span>{" "}
        </h1>
        <p className="mt-1 text-sm font-medium text-[#386FA4]">
          Where will your next journey take you?
        </p>
      </div>

      {/* Landscape illustration */}
      <div className="absolute right-0 bottom-0 w-[360px] h-full pointer-events-none">
        <img
          src={heroImgMountains}
          alt=""
          className="w-full h-full object-contain object-right select-none "
        />
      </div>
    </motion.div>
  );
}
