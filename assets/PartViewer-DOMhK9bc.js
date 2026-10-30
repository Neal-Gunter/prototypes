import{r as e}from"./rolldown-runtime-XKyaHtl9.js";import{n as t,t as n}from"./jsx-runtime-C3cWAN_r.js";import{c as r}from"./index-Drwfj457.js";import{Dr as i,E as a,Lt as o,U as s,an as c,ar as l,fa as u,io as d,ir as f,jn as p,kr as m,kt as h,mo as g,no as _,on as v,pn as y,qa as b,ro as x,ta as ee,tr as S}from"./three-base-C_ZE2l4L.js";import{d as C,l as te,n as ne,r as re,s as ie,t as w}from"./OrbitControls-DBLziAwo.js";import{r as T}from"./Gltf-D3igDNp8.js";import{i as E,n as ae}from"./catalog-JErWbTtl.js";import{a as oe,i as se,n as D}from"./partMeshes-Cod6e2v9.js";var O=e(t()),ce=e(r()),k=new x,A=new x,j=new x,M=new _;function le(e,t,n){let r=k.setFromMatrixPosition(e.matrixWorld);r.project(t);let i=n.width/2,a=n.height/2;return[r.x*i+i,-(r.y*a)+a]}function ue(e,t){let n=k.setFromMatrixPosition(e.matrixWorld),r=A.setFromMatrixPosition(t.matrixWorld),i=n.sub(r),a=t.getWorldDirection(j);return i.angleTo(a)>Math.PI/2}function de(e,t,n,r){let i=k.setFromMatrixPosition(e.matrixWorld),a=i.clone();a.project(t),M.set(a.x,a.y),n.setFromCamera(M,t);let o=n.intersectObjects(r,!0);if(o.length){let e=o[0].distance;return i.distanceTo(n.ray.origin)<e}return!0}function fe(e,t){if(t instanceof i)return t.zoom;if(t instanceof m){let n=k.setFromMatrixPosition(e.matrixWorld),r=A.setFromMatrixPosition(t.matrixWorld),i=t.fov*Math.PI/180,a=n.distanceTo(r);return 1/(2*Math.tan(i/2)*a)}return 1}function pe(e,t,n){if(t instanceof m||t instanceof i){let r=k.setFromMatrixPosition(e.matrixWorld),i=A.setFromMatrixPosition(t.matrixWorld),a=r.distanceTo(i),o=(n[1]-n[0])/(t.far-t.near),s=n[1]-o*t.far;return Math.round(o*a+s)}}var me=e=>Math.abs(e)<1e-10?0:e;function N(e,t,n=``){let r=`matrix3d(`;for(let n=0;n!==16;n++)r+=me(t[n]*e.elements[n])+(n===15?`)`:`,`);return n+r}var he=(e=>t=>N(t,e))([1,-1,1,1,1,-1,1,1,1,-1,1,1,1,-1,1,1]),ge=(e=>(t,n)=>N(t,e(n),`translate(-50%,-50%)`))(e=>[1/e,1/e,1/e,1,-1/e,-1/e,-1/e,-1,1/e,1/e,1/e,1,1,1,1,1]);function _e(e){return e&&typeof e==`object`&&`current`in e}var P=O.forwardRef(({children:e,eps:t=.001,style:n,className:r,prepend:i,center:a,fullscreen:o,portal:s,distanceFactor:c,sprite:l=!1,transform:u=!1,occlude:d,onOcclude:f,castShadow:p,receiveShadow:m,material:h,geometry:g,zIndexRange:_=[16777271,0],calculatePosition:v=le,as:y=`div`,wrapperClass:b,pointerEvents:ee=`auto`,...S},C)=>{let{gl:re,camera:w,scene:T,size:E,raycaster:ae,events:oe,viewport:se}=te(),[D]=O.useState(()=>document.createElement(y)),k=O.useRef(null),A=O.useRef(null),j=O.useRef(0),M=O.useRef([0,0]),N=O.useRef(null),P=O.useRef(null),F=s?.current||oe.connected||re.domElement.parentNode,I=O.useRef(null),L=O.useRef(!1),R=O.useMemo(()=>d&&d!==`blending`||Array.isArray(d)&&d.length&&_e(d[0]),[d]);O.useLayoutEffect(()=>{let e=re.domElement;d&&d===`blending`?(e.style.zIndex=`${Math.floor(_[0]/2)}`,e.style.position=`absolute`,e.style.pointerEvents=`none`):(e.style.zIndex=null,e.style.position=null,e.style.pointerEvents=null)},[d]),O.useLayoutEffect(()=>{if(A.current){let e=k.current=ce.createRoot(D);if(T.updateMatrixWorld(),u)D.style.cssText=`position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;`;else{let e=v(A.current,w,E);D.style.cssText=`position:absolute;top:0;left:0;transform:translate3d(${e[0]}px,${e[1]}px,0);transform-origin:0 0;`}return F&&(i?F.prepend(D):F.appendChild(D)),()=>{F&&F.removeChild(D),e.unmount()}}},[F,u]),O.useLayoutEffect(()=>{b&&(D.className=b)},[b]);let z=O.useMemo(()=>u?{position:`absolute`,top:0,left:0,width:E.width,height:E.height,transformStyle:`preserve-3d`,pointerEvents:`none`}:{position:`absolute`,transform:a?`translate3d(-50%,-50%,0)`:`none`,...o&&{top:-E.height/2,left:-E.width/2,width:E.width,height:E.height},...n},[n,a,o,E,u]),B=O.useMemo(()=>({position:`absolute`,pointerEvents:ee}),[ee]);O.useLayoutEffect(()=>{if(L.current=!1,u){var t;(t=k.current)==null||t.render(O.createElement(`div`,{ref:N,style:z},O.createElement(`div`,{ref:P,style:B},O.createElement(`div`,{ref:C,className:r,style:n,children:e}))))}else{var i;(i=k.current)==null||i.render(O.createElement(`div`,{ref:C,style:z,className:r,children:e}))}});let V=O.useRef(!0);ie(e=>{if(A.current){w.updateMatrixWorld(),A.current.updateWorldMatrix(!0,!1);let e=u?M.current:v(A.current,w,E);if(u||Math.abs(j.current-w.zoom)>t||Math.abs(M.current[0]-e[0])>t||Math.abs(M.current[1]-e[1])>t){let t=ue(A.current,w),n=!1;R&&(Array.isArray(d)?n=d.map(e=>e.current):d!==`blending`&&(n=[T]));let r=V.current;if(n){let e=de(A.current,w,ae,n);V.current=e&&!t}else V.current=!t;r!==V.current&&(f?f(!V.current):D.style.display=V.current?`block`:`none`);let i=Math.floor(_[0]/2),a=d?R?[_[0],i]:[i-1,0]:_;if(D.style.zIndex=`${pe(A.current,w,a)}`,u){let[e,t]=[E.width/2,E.height/2],n=w.projectionMatrix.elements[5]*t,{isOrthographicCamera:r,top:i,left:a,bottom:o,right:s}=w,u=he(w.matrixWorldInverse),d=r?`scale(${n})translate(${me(-(s+a)/2)}px,${me((i+o)/2)}px)`:`translateZ(${n}px)`,f=A.current.matrixWorld;l&&(f=w.matrixWorldInverse.clone().transpose().copyPosition(f).scale(A.current.scale),f.elements[3]=f.elements[7]=f.elements[11]=0,f.elements[15]=1),D.style.width=E.width+`px`,D.style.height=E.height+`px`,D.style.perspective=r?``:`${n}px`,N.current&&P.current&&(N.current.style.transform=`${d}${u}translate(${e}px,${t}px)`,P.current.style.transform=ge(f,1/((c||10)/400)))}else{let t=c===void 0?1:fe(A.current,w)*c;D.style.transform=`translate3d(${e[0]}px,${e[1]}px,0) scale(${t})`}M.current=e,j.current=w.zoom}}if(!R&&I.current&&!L.current){if(u){if(N.current){let e=N.current.children[0];if(e!=null&&e.clientWidth&&e!=null&&e.clientHeight){let{isOrthographicCamera:t}=w;if(t||g)S.scale&&(Array.isArray(S.scale)?S.scale instanceof x?I.current.scale.copy(S.scale.clone().divideScalar(1)):I.current.scale.set(1/S.scale[0],1/S.scale[1],1/S.scale[2]):I.current.scale.setScalar(1/S.scale));else{let t=(c||10)/400,n=e.clientWidth*t,r=e.clientHeight*t;I.current.scale.set(n,r,1)}L.current=!0}}}else{let t=D.children[0];if(t!=null&&t.clientWidth&&t!=null&&t.clientHeight){let e=1/se.factor,n=t.clientWidth*e,r=t.clientHeight*e;I.current.scale.set(n,r,1),L.current=!0}I.current.lookAt(e.camera.position)}}});let H=O.useMemo(()=>({vertexShader:u?void 0:`
          /*
            This shader is from the THREE's SpriteMaterial.
            We need to turn the backing plane into a Sprite
            (make it always face the camera) if "transfrom"
            is false.
          */
          #include <common>

          void main() {
            vec2 center = vec2(0., 1.);
            float rotation = 0.0;

            // This is somewhat arbitrary, but it seems to work well
            // Need to figure out how to derive this dynamically if it even matters
            float size = 0.03;

            vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
            vec2 scale;
            scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
            scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );

            bool isPerspective = isPerspectiveMatrix( projectionMatrix );
            if ( isPerspective ) scale *= - mvPosition.z;

            vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale * size;
            vec2 rotatedPosition;
            rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
            rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
            mvPosition.xy += rotatedPosition;

            gl_Position = projectionMatrix * mvPosition;
          }
      `,fragmentShader:`
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      `}),[u]);return O.createElement(`group`,ne({},S,{ref:A}),d&&!R&&O.createElement(`mesh`,{castShadow:p,receiveShadow:m,ref:I},g||O.createElement(`planeGeometry`,null),h||O.createElement(`shaderMaterial`,{side:2,vertexShader:H.vertexShader,fragmentShader:H.fragmentShader})))}),F=T>=125?`uv1`:`uv2`,I=new a,L=new x,R=class extends c{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new o([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new o([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new v(t,6,1);return this.setAttribute(`instanceStart`,new y(n,3,0)),this.setAttribute(`instanceEnd`,new y(n,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let n;e instanceof Float32Array?n=e:Array.isArray(e)&&(n=new Float32Array(e));let r=new v(n,t*2,1);return this.setAttribute(`instanceColorStart`,new y(r,t,0)),this.setAttribute(`instanceColorEnd`,new y(r,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new g(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new a);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),I.setFromBufferAttribute(t),this.boundingBox.union(I))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new u),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)L.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(L)),L.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(L));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}applyMatrix(e){return console.warn(`THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().`),this.applyMatrix4(e)}},z=class extends R{constructor(){super(),this.isLineGeometry=!0,this.type=`LineGeometry`}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setPositions(n),this}setColors(e,t=3){let n=e.length-t,r=new Float32Array(2*n);if(t===3)for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5];else for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5],r[2*i+6]=e[i+6],r[2*i+7]=e[i+7];return super.setColors(r,t),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}},B=class extends ee{constructor(e){super({type:`LineMaterial`,uniforms:b.clone(b.merge([C.common,C.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new _(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${T>=154?`colorspace_fragment`:`encodings_fragment`}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA=`1`:delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(e){this.uniforms.diffuse.value=e}},worldUnits:{enumerable:!0,get:function(){return`WORLD_UNITS`in this.defines},set:function(e){e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(e){this.uniforms.linewidth.value=e}},dashed:{enumerable:!0,get:function(){return`USE_DASH`in this.defines},set(e){!!e!=`USE_DASH`in this.defines&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(e){this.uniforms.dashScale.value=e}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(e){this.uniforms.dashSize.value=e}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(e){this.uniforms.dashOffset.value=e}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(e){this.uniforms.gapSize.value=e}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(e){this.uniforms.opacity.value=e}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(e){this.uniforms.resolution.value.copy(e)}},alphaToCoverage:{enumerable:!0,get:function(){return`USE_ALPHA_TO_COVERAGE`in this.defines},set:function(e){!!e!=`USE_ALPHA_TO_COVERAGE`in this.defines&&(this.needsUpdate=!0),e===!0?(this.defines.USE_ALPHA_TO_COVERAGE=``,this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}},V=new d,H=new x,ve=new x,U=new d,W=new d,G=new d,ye=new x,be=new f,K=new p,xe=new x,q=new a,J=new u,Y=new d,X,Z;function Se(e,t,n){return Y.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),Y.multiplyScalar(1/Y.w),Y.x=Z/n.width,Y.y=Z/n.height,Y.applyMatrix4(e.projectionMatrixInverse),Y.multiplyScalar(1/Y.w),Math.abs(Math.max(Y.x,Y.y))}function Ce(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){K.start.fromBufferAttribute(i,r),K.end.fromBufferAttribute(a,r),K.applyMatrix4(n);let o=new x,s=new x;X.distanceSqToSegment(K.start,K.end,s,o),s.distanceTo(o)<Z*.5&&t.push({point:s,pointOnLine:o,distance:X.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,[F]:null})}}function we(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;X.at(1,G),G.w=1,G.applyMatrix4(t.matrixWorldInverse),G.applyMatrix4(r),G.multiplyScalar(1/G.w),G.x*=i.x/2,G.y*=i.y/2,G.z=0,ye.copy(G),be.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(U.fromBufferAttribute(s,t),W.fromBufferAttribute(c,t),U.w=1,W.w=1,U.applyMatrix4(be),W.applyMatrix4(be),U.z>u&&W.z>u)continue;if(U.z>u){let e=U.z-W.z,t=(U.z-u)/e;U.lerp(W,t)}else if(W.z>u){let e=W.z-U.z,t=(W.z-u)/e;W.lerp(U,t)}U.applyMatrix4(r),W.applyMatrix4(r),U.multiplyScalar(1/U.w),W.multiplyScalar(1/W.w),U.x*=i.x/2,U.y*=i.y/2,W.x*=i.x/2,W.y*=i.y/2,K.start.copy(U),K.start.z=0,K.end.copy(W),K.end.z=0;let o=K.closestPointToPointParameter(ye,!0);K.at(o,xe);let l=S.lerp(U.z,W.z,o),d=l>=-1&&l<=1,f=ye.distanceTo(xe)<Z*.5;if(d&&f){K.start.fromBufferAttribute(s,t),K.end.fromBufferAttribute(c,t),K.start.applyMatrix4(a),K.end.applyMatrix4(a);let r=new x,i=new x;X.distanceSqToSegment(K.start,K.end,i,r),n.push({point:i,pointOnLine:r,distance:X.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,[F]:null})}}}var Te=class extends l{constructor(e=new R,t=new B({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)H.fromBufferAttribute(t,e),ve.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+H.distanceTo(ve);let i=new v(r,2,1);return e.setAttribute(`instanceDistanceStart`,new y(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new y(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`);let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;X=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;Z=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),J.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?Z*.5:Se(r,Math.max(r.near,J.distanceToPoint(X.origin)),s.resolution),J.radius+=c,X.intersectsSphere(J)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),q.copy(o.boundingBox).applyMatrix4(a);let l;l=n?Z*.5:Se(r,Math.max(r.near,q.distanceToPoint(X.origin)),s.resolution),q.expandByScalar(l),X.intersectsBox(q)!==!1&&(n?Ce(this,t):we(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(V),this.material.uniforms.resolution.value.set(V.z,V.w))}},Ee=class extends Te{constructor(e=new z,t=new B({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type=`Line2`}},De=O.forwardRef(function({points:e,color:t=16777215,vertexColors:n,linewidth:r,lineWidth:i,segments:a,dashed:o,...c},l){var u;let f=te(e=>e.size),p=O.useMemo(()=>a?new Te:new Ee,[a]),[m]=O.useState(()=>new B),h=(n==null||(u=n[0])==null?void 0:u.length)===4?4:3,g=O.useMemo(()=>{let r=a?new R:new z,i=e.map(e=>{let t=Array.isArray(e);return e instanceof x||e instanceof d?[e.x,e.y,e.z]:e instanceof _?[e.x,e.y,0]:t&&e.length===3?[e[0],e[1],e[2]]:t&&e.length===2?[e[0],e[1],0]:e});if(r.setPositions(i.flat()),n){t=16777215;let e=n.map(e=>e instanceof s?e.toArray():e);r.setColors(e.flat(),h)}return r},[e,a,n,h]);return O.useLayoutEffect(()=>{p.computeLineDistances()},[e,p]),O.useLayoutEffect(()=>{o?m.defines.USE_DASH=``:delete m.defines.USE_DASH,m.needsUpdate=!0},[o,m]),O.useEffect(()=>()=>{g.dispose(),m.dispose()},[g]),O.createElement(`primitive`,ne({object:p,ref:l},c),O.createElement(`primitive`,{object:g,attach:`geometry`}),O.createElement(`primitive`,ne({object:m,attach:`material`,color:t,vertexColors:!!n,resolution:[f.width,f.height],linewidth:r??i??1,dashed:o,transparent:h===4},c)))}),Q=n();function Oe(e){return e<=12?1:e<=60?5:e<=250?10:50}function $({from:e,dir:t,len:n,label:r,side:i}){let[a,o]=(0,O.useState)(!1);(0,O.useEffect)(()=>{let e=setTimeout(()=>o(!0),30);return()=>clearTimeout(e)},[]);let s=n*10,c=Oe(s),l=[e,e.map((e,r)=>e+t[r]*n)],u=[];for(let r=0;r<=s+1e-6;r+=c){let a=e.map((e,n)=>e+t[n]*r/10),o=Math.round(r)%(c*5)==0,s=a.map((e,t)=>e+i[t]*(o?.25:.12)*Math.max(.4,n/6));u.push((0,Q.jsx)(De,{points:[a,s],color:`#b45309`,lineWidth:1},r))}let d=e.map((e,r)=>e+t[r]*n/2+i[r]*.5*Math.max(.5,n/5));return(0,Q.jsxs)(`group`,{children:[(0,Q.jsx)(De,{points:l,color:`#b45309`,lineWidth:2}),u,a&&(0,Q.jsx)(P,{position:d,center:!0,zIndexRange:[20,0],children:(0,Q.jsx)(`span`,{className:`pointer-events-none select-none whitespace-nowrap rounded bg-white/90 px-1 text-[11px] text-amber-800`,"data-testid":`ruler-label`,children:r})})]})}function ke({d:e}){let t=e.x/10,n=e.y/10,r=e.z/10,i=[-t/2,0,r/2+.15];return(0,Q.jsxs)(`group`,{children:[(0,Q.jsx)($,{from:i,dir:[1,0,0],len:t,side:[0,0,1],label:`长 ${e.x} mm`}),(0,Q.jsx)($,{from:[t/2+.15,0,r/2],dir:[0,0,-1],len:r,side:[1,0,0],label:`宽 ${e.z} mm`}),(0,Q.jsx)($,{from:[-t/2-.15,0,r/2],dir:[0,1,0],len:n,side:[-1,0,0],label:`高 ${e.y} mm`})]})}var Ae=[[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]];function je({cols:e}){let t=(0,O.useMemo)(()=>e.map(e=>{let t=e.hull?oe(e):null;if(t){let n=new h(t,20).attributes.position,r=[];for(let t=0;t<n.count;t++)r.push([e.c[0]+n.getX(t),e.c[1]+n.getY(t),e.c[2]+n.getZ(t)]);return r}let n=[];for(let t=0;t<8;t++)n.push([e.c[0]+(t&1?1:-1)*e.h[0],e.c[1]+(t&2?1:-1)*e.h[1],e.c[2]+(t&4?1:-1)*e.h[2]]);return Ae.flatMap(([e,t])=>[n[e],n[t]])}),[e]),n=[`#dc2626`,`#2563eb`,`#16a34a`,`#9333ea`,`#ea580c`,`#0891b2`];return(0,Q.jsx)(`group`,{children:t.map((e,t)=>(0,Q.jsx)(De,{points:e,segments:!0,color:n[t%n.length],lineWidth:1.5,depthTest:!1,transparent:!0,opacity:.85},t))})}function Me({id:e}){let[t,n]=(0,O.useState)(null),[r,i]=(0,O.useState)(!0),[a,o]=(0,O.useState)(!1);(0,O.useEffect)(()=>{n(null),e&&ae(e).then(e=>n(e?E(e):null)).catch(()=>n(null))},[e]);let s=t?.dims_mm,c=(0,O.useMemo)(()=>{let e=s?Math.max(s.x,s.y,s.z)/10:5;return[e*1.9,e*1.5,e*2.4]},[s]);return t?(0,Q.jsxs)(`div`,{className:`relative`,"data-testid":`part-viewer`,children:[(0,Q.jsx)(`div`,{className:`aspect-square w-full border border-line bg-white`,children:(0,Q.jsxs)(re,{camera:{position:c,fov:35,near:.01,far:500},dpr:[1,1.5],frameloop:`demand`,children:[(0,Q.jsx)(`ambientLight`,{intensity:.8}),(0,Q.jsx)(`directionalLight`,{position:[5,8,6],intensity:1.4}),(0,Q.jsx)(O.Suspense,{fallback:null,children:t.kind===`glb`?(0,Q.jsx)(D,{def:t}):(0,Q.jsx)(se,{def:t})}),r&&(0,Q.jsx)(ke,{d:s}),a&&(0,Q.jsx)(je,{cols:t.colliders}),(0,Q.jsx)(`gridHelper`,{args:[Math.ceil(Math.max(s.x,s.z)/10)*2+2,Math.ceil(Math.max(s.x,s.z)/10)*2+2,`#cbd5e1`,`#e2e8f0`]}),(0,Q.jsx)(w,{makeDefault:!0,target:[0,s.y/20,0]})]},e)}),(0,Q.jsxs)(`div`,{className:`mt-1 flex items-center justify-between text-xs text-ink-soft`,children:[(0,Q.jsxs)(`span`,{children:[`网格 1 格 = 10 mm；刻度 `,Oe(Math.max(s.x,s.y,s.z)),` mm`]}),(0,Q.jsxs)(`span`,{className:`flex gap-1`,children:[(0,Q.jsx)(`button`,{type:`button`,onClick:()=>o(e=>!e),"aria-pressed":a,className:`border border-line px-2 py-0.5`,"data-testid":`collider-toggle`,children:a?`隐藏碰撞体`:`显示碰撞体`}),(0,Q.jsx)(`button`,{type:`button`,onClick:()=>i(e=>!e),"aria-pressed":r,className:`border border-line px-2 py-0.5`,"data-testid":`ruler-toggle`,children:r?`隐藏标尺`:`显示标尺`})]})]}),a&&(0,Q.jsxs)(`p`,{className:`mt-1 text-[11px] leading-snug text-ink-soft`,"data-testid":`collider-info`,children:[`碰撞体：`,t.colliders.filter(e=>e.hull).length?`${t.colliders.length} 个凸包`:`${t.colliders.length} 个盒`,`（物理引擎按这些凸块算碰撞）。`,t.collider_decomp?.hull?(0,Q.jsxs)(Q.Fragment,{children:[`凸包分解（构建时，我的补充）：先做体素凸分解（体素 `,t.collider_decomp.cell_mm,` mm，容差 `,t.collider_decomp.tol_mm,` mm），原来 `,t.collider_decomp.hull.boxes,` 个盒 → 收紧合并成 `,t.collider_decomp.hull.n,` 个凸包；比可见网格最多外扩 `,t.collider_decomp.hull.box_exMax_mm,` → `,t.collider_decomp.hull.exMax_mm,` mm（中位 `,t.collider_decomp.hull.p50_mm,` mm），网格顶点全部被覆盖。`]}):t.collider_decomp?(0,Q.jsxs)(Q.Fragment,{children:[`体素凸分解（构建时，我的补充）：体素 `,t.collider_decomp.cell_mm,` mm，盒子比可见网格最多外扩 `,t.collider_decomp.exMax_mm,` mm（容差 `,t.collider_decomp.tol_mm,` mm = 体素对角线），网格表面全部被覆盖。`]}):t.kind===`glb`?(0,Q.jsx)(Q.Fragment,{children:`由模型各部件的包围盒自动生成，可能比外形稍大（估算）。`}):(0,Q.jsx)(Q.Fragment,{children:`程序生成零件，碰撞盒即外形（近似）。`})]})]}):(0,Q.jsx)(`div`,{className:`flex aspect-square w-full items-center justify-center border border-line bg-paper-2 text-xs text-ink-soft`,children:`加载模型…`})}export{Me as default};