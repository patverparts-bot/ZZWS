import XLSX from './vendor/xlsx.mjs';

const XML_HEADER='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/_x[0-9a-f]{4}_/gi,value=>'_x005F_'+value.slice(1)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const textCell=(address,value,style)=>`<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const numberCell=(address,value,style)=>`<c r="${address}" s="${style}"><v>${Number(value)}</v></c>`;
const row=(number,height,cells)=>`<row r="${number}" ht="${height}" customHeight="1">${cells.join('')}</row>`;
function linesFor(value,width){
 let count=0;for(const part of String(value??'').split(/\r?\n/)){let used=0;count++;for(const word of part.split(/\s+/)){const size=[...word].length;if(!size)continue;if(size>width){if(used){count++;used=0;}count+=Math.floor((size-1)/width);used=(size-1)%width+1;}else if(used&&used+1+size>width){count++;used=size;}else used+=size+(used?1:0);}}return count;
}
const rowHeight=(name,sku)=>Math.min(409,Math.max(32,12+15*Math.max(linesFor(name,50),linesFor(sku,15))));
function yerevanDate(value){
 const date=new Date(value);if(!Number.isFinite(date.valueOf()))return '—';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Yerevan',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
 return `${parts.day}.${parts.month}.${parts.year} · ${parts.hour}:${parts.minute} (Երևան)`;
}
function styleXml(){
 const font=(size,color,bold=false)=>`<font>${bold?'<b/>':''}<sz val="${size}"/><color rgb="FF${color}"/><name val="Arial"/><family val="2"/></font>`;
 const xf=(fontId=0,fillId=0,borderId=0,numFmtId=0,horizontal='left',wrap=true)=>`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${numFmtId?' applyNumberFormat="1"':''}><alignment horizontal="${horizontal}" vertical="center"${wrap?' wrapText="1"':''}/></xf>`;
 const body=(format,align='left',fill=0)=>xf(0,fill,1,format,align);
 const formats=[xf(),xf(1),xf(2),xf(),xf(3,2,1,0,'center'),body(49),body(0),body(3,'center'),body(3,'right'),xf(4,4,2,0,'right'),xf(4,4,2,3,'right'),xf(5),body(49,'left',3),body(0,'left',3),body(3,'center',3),body(3,'right',3)];
 return XML_HEADER+`<styleSheet xmlns="${MAIN}"><fonts count="6">${font(11,'203046')+font(18,'193A64',true)+font(10,'52657F',true)+font(10,'FFFFFF',true)+font(13,'193A64',true)+font(9,'63748A')}</fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF193A64"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F7FB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EFF8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFDDE5EF"/></left><right style="thin"><color rgb="FFDDE5EF"/></right><top style="thin"><color rgb="FFDDE5EF"/></top><bottom style="thin"><color rgb="FFDDE5EF"/></bottom><diagonal/></border><border><left/><right/><top style="medium"><color rgb="FF193A64"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${formats.length}">${formats.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
}
function worksheetXml(offer){
 const number=typeof offer.number==='string'&&/^ZZWS-\d{6,16}$/.test(offer.number)?offer.number:'—';
 const rows=[row(1,38,[textCell('A1','ZIGZAG · Առաջարկ գնորդի համար',1)]),row(2,Math.max(30,12+15*linesFor(offer.buyer.name,90)),[textCell('A2','Գնորդ',2),textCell('B2',offer.buyer.name,3)]),row(3,28,[textCell('A3','Հեռախոս',2),textCell('B3',offer.buyer.phone,3)]),row(4,28,[textCell('A4','Առաջարկի համար',2),textCell('B4',number,3)]),row(5,28,[textCell('A5','Ամսաթիվ',2),textCell('B5',yerevanDate(offer.finalizedAt||offer.createdAt),3)]),row(6,10,[]),row(7,42,['Արտիկուլ','Անվանում','Քանակ\n(հատ)','Միավորի գին\n(֏)','Գումար\n(֏)'].map((value,i)=>textCell('ABCDE'[i]+'7',value,4)))];
 offer.lines.forEach((line,i)=>{const n=i+8,striped=i%2?7:0;rows.push(row(n,rowHeight(line.name,line.articul),[textCell('A'+n,line.articul,5+striped),textCell('B'+n,line.name,6+striped),numberCell('C'+n,line.qty,7+striped),numberCell('D'+n,line.salePrice,8+striped),numberCell('E'+n,line.amount,8+striped)]));});
 const lastData=offer.lines.length+7,totalRow=lastData+2,footerRow=totalRow+2;
 rows.push(row(lastData+1,10,[]),row(totalRow,32,['A','B','C','D'].map((col,i)=>textCell(col+totalRow,i===0?'Ընդամենը՝':'',9)).concat(numberCell('E'+totalRow,offer.total,10))),row(totalRow+1,8,[]),row(footerRow,23,[textCell('A'+footerRow,'Արժույթ՝ ՀՀ դրամ (֏)',11)]));
 const merges=['A1:E1','B2:E2','B3:E3','B4:E4','B5:E5',`A${totalRow}:D${totalRow}`,`A${footerRow}:E${footerRow}`];
 return {lastRow:footerRow,xml:XML_HEADER+`<worksheet xmlns="${MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:E${footerRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A8" sqref="A8"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${[18,65,12,20,22].map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A7:E${lastData}"/><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.15" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;C&amp;P / &amp;N</oddFooter></headerFooter><ignoredErrors><ignoredError numberStoredAsText="1" sqref="A1:E${footerRow}"/></ignoredErrors></worksheet>`};
}
// SheetJS CE does not persist custom cell styles. Patch the generated OOXML via
// its bundled, documented CFB ZIP API; no Node-only APIs or new dependency.
export function styledBuyerOfferWorkbook(offer){
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['ZIGZAG']]),'Առաջարկ');
 const bytes=new Uint8Array(XLSX.write(book,{type:'array',bookType:'xlsx'})),zip=XLSX.CFB.read(bytes,{type:'buffer'}),encoder=new TextEncoder();
 const find=name=>{const index=zip.FullPaths.findIndex(value=>value.endsWith('/'+name));if(index<0)throw Error('Invalid workbook package');return zip.FileIndex[index];};
 const add=(name,content)=>XLSX.CFB.utils.cfb_add(zip,'/'+name,encoder.encode(content));
 const sheet=worksheetXml(offer),printNames=`<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">&apos;Առաջարկ&apos;!$A$1:$E$${sheet.lastRow}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">&apos;Առաջարկ&apos;!$7:$7</definedName></definedNames>`;
 const workbook=new TextDecoder().decode(find('xl/workbook.xml').content).replace('</workbook>',printNames+'</workbook>');
 add('xl/worksheets/sheet1.xml',sheet.xml);add('xl/styles.xml',styleXml());add('xl/workbook.xml',workbook);
 const binary=XLSX.CFB.write(zip,{fileType:'zip',type:'binary',compression:true});return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
